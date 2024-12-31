import Curve from '@/potrace/types/Curve'
import Point from '@/potrace/types/Point'
import Path from '@/potrace/types/Path'
import Quad from '@/potrace/types/Quad'
import Sum from '@/potrace/types/Sum'
import Opti from '@/potrace/types/Opti'
import utils from '@/potrace/utils'
import Bitmap from '@/potrace/types/Bitmap'

/**
 * @typedef {Object} PotraceOptions
 * @property {('black'|'white'|'left'|'right'|'minority'|'majority')} [turnPolicy='minority'] - How to resolve ambiguities in path decomposition
 * @property {number} [turdSize=2] - Suppress speckles of up to this size (must be >= 0)
 * @property {number} [alphaMax=1] - Corner threshold parameter (must be >= 0)
 * @property {boolean} [optCurve=true] - Enable/disable curve optimization
 * @property {number} [optTolerance=0.2] - Curve optimization tolerance (must be >= 0)
 * @property {number|'auto'} [threshold='auto'] - Threshold below which color is considered black (0-255 or 'auto')
 * @property {boolean} [blackOnWhite=true] - Specifies which side of threshold to trace
 * @property {string} [color='auto'] - Foreground color ('auto', 'black', 'white', or any valid CSS color)
 * @property {string} [background='transparent'] - Background color (any valid CSS color)
 * @property {number|number[]|'auto'} [steps='auto'] - Number of posterization steps or array of threshold values
 * @property {('spread'|'dominant'|'median'|'mean')} [fillStrategy='dominant'] - Color selection strategy for posterization
 * @property {('auto'|'equal')} [rangeDistribution='auto'] - Distribution strategy for posterization ranges
 */

/**
 * @typedef {Object} PathData
 * @property {string} d - SVG path data string
 * @property {string} fillOpacity - Fill opacity value
 */

/**
 * @typedef {Object} ProcessedPaths
 * @property {number} width - Image width
 * @property {number} height - Image height
 * @property {boolean} dark - Whether image is dark on light background
 * @property {Array<PathData>} paths - Array of SVG path data
 */

/**
 * @typedef {Object} ColorRange
 * @property {number} value - Threshold value
 * @property {number} colorIntensity - Color intensity value between 0 and 1
 */

/**
 * @typedef {Object} ColorStats
 * @property {number} pixels - Number of pixels in range
 * @property {{mean: number, median: number, stdDev: number}} levels - Statistical measures
 */

/**
 * @typedef {Object} ConstraintPoint
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {Object} Sum
 * @property {number} x - Sum of x coordinates
 * @property {number} y - Sum of y coordinates
 * @property {number} xy - Sum of x*y products
 * @property {number} x2 - Sum of x^2 values
 * @property {number} y2 - Sum of y^2 values
 */

/**
 * @typedef {Object} Curve
 * @property {number} n - Number of vertices
 * @property {Point[]} vertex - Array of vertex points
 * @property {('CORNER'|'CURVE')[]} tag - Type of each vertex
 * @property {Point[]} c - Control points
 * @property {number[]} alpha - Alpha values for each vertex
 * @property {number[]} alpha0 - Initial alpha values
 * @property {number[]} beta - Beta values for each vertex
 * @property {boolean} alpha_curve - Whether curve uses alpha values
 */

/**
 * @typedef {Object} Quad
 * @property {number[]} data - 3x3 matrix stored as flat array
 * @property {function(number, number): number} at - Function to get value at position
 */

/**
 * @typedef {Object} Opti
 * @property {Point[]} c - Control points
 * @property {number} alpha - Alpha value
 * @property {number} t - Parameter t
 * @property {number} s - Parameter s
 * @property {number} pen - Penalty value
 */

/**
 * Converts an image into SVG paths
 * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
 * @param {PotraceOptions} [options={}] - Potrace options
 * @returns {ProcessedPaths} Object containing width, height, dark flag and paths
 */
export const as_paths = (image_data, options = {}) => {
  const potrace = new Potrace(options)
  return potrace.create_paths(image_data)
}

/**
 * Potrace class for converting bitmap images to vector graphics
 * @class
 */
class Potrace {
  /** @type {'auto'} */
  static COLOR_AUTO = 'auto'

  /** @type {'transparent'} */
  static COLOR_TRANSPARENT = 'transparent'

  /** @type {-1} */
  static THRESHOLD_AUTO = -1

  static STEPS_AUTO = -1
  static FILL_SPREAD = 'spread'
  static FILL_DOMINANT = 'dominant'
  static FILL_MEDIAN = 'median'
  static FILL_MEAN = 'mean'
  static RANGES_AUTO = 'auto'
  static RANGES_EQUAL = 'equal'

  /** @type {Record<string, string>} */
  static turn_policy = {
    black: 'black',
    white: 'white',
    left: 'left',
    right: 'right',
    minority: 'minority',
    majority: 'majority'
  }

  /** @type {string[]} */
  static supported_turn_policy_values = Object.values(Potrace.turn_policy)

  /** @type {import('./types/Bitmap')|null} */
  #luminance_data = null

  /** @type {Path[]} */
  #pathlist = []

  /** @type {string|null} */
  #image_loading_identifier = null

  /** @type {boolean} */
  #image_loaded = false

  /** @type {boolean} */
  #processed = false

  /** @type {number|null} */
  #calculated_threshold = null

  /**
   * @type {Required<PotraceOptions>}
   * @private
   */
  #params = {
    turnPolicy: Potrace.turn_policy.minority,
    turdSize: 2,
    alphaMax: 1,
    optCurve: true,
    optTolerance: 0.2,
    threshold: Potrace.THRESHOLD_AUTO,
    blackOnWhite: true,
    color: Potrace.COLOR_AUTO,
    background: Potrace.COLOR_TRANSPARENT,
    steps: Potrace.STEPS_AUTO,
    fillStrategy: Potrace.FILL_DOMINANT,
    rangeDistribution: Potrace.RANGES_AUTO
  }

  /**
   * Creates a new Potrace instance
   * @param {PotraceOptions} [options] - Configuration options
   * @throws {Error} If options are invalid
   */
  constructor(options) {
    if (options) this.#set_parameters(options)
    if (this.#params.steps) this.#calculated_threshold = null
  }

  /**
   * @private
   * @param {Bitmap} black_map - Binary bitmap data
   * @param {Point} point - Starting point coordinates
   * @returns {Point|false} Next point or false if not found
   */
  #find_next(black_map, point) {
    let i = black_map.point_to_index(point)
    while (i < black_map.size && black_map.data[i] !== 1) {
      i++
    }
    return i < black_map.size && black_map.index_to_point(i)
  }

  /**
   * @private
   * @param {Bitmap} black_map - Binary bitmap data
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {0|1} Majority value (0 or 1)
   */
  #get_majority(black_map, x, y) {
    let ct
    for (let i = 2; i < 5; i++) {
      ct = 0
      for (let a = -i + 1; a <= i - 1; a++) {
        ct += black_map.get_value_at(x + a, y + i - 1) ? 1 : -1
        ct += black_map.get_value_at(x + i - 1, y + a - 1) ? 1 : -1
        ct += black_map.get_value_at(x + a - 1, y - i) ? 1 : -1
        ct += black_map.get_value_at(x - i, y + a) ? 1 : -1
      }
      if (ct > 0) return 1
      if (ct < 0) return 0
    }
    return 0
  }

  /**
   * @private
   * @param {Bitmap} black_map - Binary bitmap data
   * @param {Point} point - Starting point coordinates
   * @returns {Path} Generated path
   */
  #find_path(black_map, point) {
    const path = new Path()
    let x = point.x
    let y = point.y
    let dir_x = 0
    let dir_y = 1

    path.sign = black_map.get_value_at(point.x, point.y) ? '+' : '-'

    while (true) {
      path.pt.push(new Point(x, y))
      path.max_x = Math.max(path.max_x, x)
      path.min_x = Math.min(path.min_x, x)
      path.max_y = Math.max(path.max_y, y)
      path.min_y = Math.min(path.min_y, y)
      path.len++

      x += dir_x
      y += dir_y
      path.area -= x * dir_y

      if (x === point.x && y === point.y) break

      const l = black_map.get_value_at(
        x + (dir_x + dir_y - 1) / 2,
        y + (dir_y - dir_x - 1) / 2
      )
      const r = black_map.get_value_at(
        x + (dir_x - dir_y - 1) / 2,
        y + (dir_y + dir_x - 1) / 2
      )

      if (r && !l) {
        if (
          this.#params.turnPolicy === Potrace.turn_policy.right ||
          (this.#params.turnPolicy === Potrace.turn_policy.black &&
            path.sign === '+') ||
          (this.#params.turnPolicy === Potrace.turn_policy.white &&
            path.sign === '-') ||
          (this.#params.turnPolicy === Potrace.turn_policy.majority &&
            this.#get_majority(black_map, x, y)) ||
          (this.#params.turnPolicy === Potrace.turn_policy.minority &&
            !this.#get_majority(black_map, x, y))
        ) {
          ;[dir_x, dir_y] = [-dir_y, dir_x]
        } else {
          ;[dir_x, dir_y] = [dir_y, -dir_x]
        }
      } else if (r) {
        ;[dir_x, dir_y] = [-dir_y, dir_x]
      } else if (!l) {
        ;[dir_x, dir_y] = [dir_y, -dir_x]
      }
    }
    return path
  }

  /**
   * @private
   * @param {Bitmap} black_map - Binary bitmap data
   * @param {Path} path - Path to XOR
   * @returns {void}
   */
  #xor_path(black_map, path) {
    let y1 = path.pt[0].y
    const len = path.len

    for (let i = 1; i < len; i++) {
      const x = path.pt[i].x
      const y = path.pt[i].y

      if (y !== y1) {
        const min_y = Math.min(y1, y)
        const max_x = path.max_x

        for (let j = x; j < max_x; j++) {
          const indx = black_map.point_to_index(j, min_y)
          black_map.data[indx] = black_map.data[indx] ? 0 : 1
        }
        y1 = y
      }
    }
  }

  /**
   * @private
   * @returns {void}
   * @throws {Error} If image is not loaded
   */
  #bitmap_to_pathlist() {
    const threshold =
      this.#params.threshold === Potrace.THRESHOLD_AUTO
        ? this.#luminance_data.histogram().auto_threshold() || 128
        : this.#params.threshold

    const black_on_white = this.#params.blackOnWhite
    const black_map = this.#luminance_data.copy(lum => {
      const past_the_threshold = black_on_white
        ? lum > threshold
        : lum < threshold
      return past_the_threshold ? 0 : 1
    })

    let current_point = new Point(0, 0)
    this.#pathlist = []

    // Main loop
    while ((current_point = this.#find_next(black_map, current_point))) {
      const path = this.#find_path(black_map, current_point)
      this.#xor_path(black_map, path)

      if (path.area > this.#params.turdSize) this.#pathlist.push(path)
    }
  }

  /**
   * Calculates sums for path optimization
   * @private
   * @param {Path} path - Path to calculate sums for
   * @returns {void}
   */
  #calc_sums = path => {
    let i
    let x
    let y
    path.x0 = path.pt[0].x
    path.y0 = path.pt[0].y

    path.sums = []
    const s = path.sums
    s.push(new Sum(0, 0, 0, 0, 0))
    for (i = 0; i < path.len; i++) {
      x = path.pt[i].x - path.x0
      y = path.pt[i].y - path.y0
      s.push(
        new Sum(
          s[i].x + x,
          s[i].y + y,
          s[i].xy + x * y,
          s[i].x2 + x * x,
          s[i].y2 + y * y
        )
      )
    }
  }

  /**
   * Calculates longest sequences for path optimization
   * @private
   * @param {Path} path - Path to calculate sequences for
   * @returns {void}
   */
  #calc_lon = path => {
    const n = path.len
    const pt = path.pt
    let dir
    const pivk = []
    const nc = []
    const ct = []

    path.lon = []

    const constraint = [new Point(), new Point()]
    const cur = new Point()
    const off = new Point()
    const dk = new Point()
    let foundk

    let i
    let j
    let k1
    let a
    let b
    let c
    let d
    let k = 0
    for (i = n - 1; i >= 0; i--) {
      if (pt[i].x != pt[k].x && pt[i].y != pt[k].y) {
        k = i + 1
      }
      nc[i] = k
    }

    for (i = n - 1; i >= 0; i--) {
      ct[0] = ct[1] = ct[2] = ct[3] = 0
      dir =
        (3 +
          3 * (pt[utils.mod(i + 1, n)].x - pt[i].x) +
          (pt[utils.mod(i + 1, n)].y - pt[i].y)) /
        2
      ct[dir]++

      constraint[0].x = 0
      constraint[0].y = 0
      constraint[1].x = 0
      constraint[1].y = 0

      k = nc[i]
      k1 = i
      while (1) {
        foundk = 0
        dir =
          (3 +
            3 * utils.sign(pt[k].x - pt[k1].x) +
            utils.sign(pt[k].y - pt[k1].y)) /
          2
        ct[dir]++

        if (ct[0] && ct[1] && ct[2] && ct[3]) {
          pivk[i] = k1
          foundk = 1
          break
        }

        cur.x = pt[k].x - pt[i].x
        cur.y = pt[k].y - pt[i].y

        if (
          utils.xprod(constraint[0], cur) < 0 ||
          utils.xprod(constraint[1], cur) > 0
        ) {
          break
        }

        if (Math.abs(cur.x) <= 1 && Math.abs(cur.y) <= 1) {
        } else {
          off.x = cur.x + (cur.y >= 0 && (cur.y > 0 || cur.x < 0) ? 1 : -1)
          off.y = cur.y + (cur.x <= 0 && (cur.x < 0 || cur.y < 0) ? 1 : -1)
          if (utils.xprod(constraint[0], off) >= 0) {
            constraint[0].x = off.x
            constraint[0].y = off.y
          }
          off.x = cur.x + (cur.y <= 0 && (cur.y < 0 || cur.x < 0) ? 1 : -1)
          off.y = cur.y + (cur.x >= 0 && (cur.x > 0 || cur.y < 0) ? 1 : -1)
          if (utils.xprod(constraint[1], off) <= 0) {
            constraint[1].x = off.x
            constraint[1].y = off.y
          }
        }
        k1 = k
        k = nc[k1]
        if (!utils.cyclic(k, i, k1)) break
      }
      if (foundk === 0) {
        dk.x = utils.sign(pt[k].x - pt[k1].x)
        dk.y = utils.sign(pt[k].y - pt[k1].y)
        cur.x = pt[k1].x - pt[i].x
        cur.y = pt[k1].y - pt[i].y

        a = utils.xprod(constraint[0], cur)
        b = utils.xprod(constraint[0], dk)
        c = utils.xprod(constraint[1], cur)
        d = utils.xprod(constraint[1], dk)

        j = 10000000

        if (b < 0) {
          j = Math.floor(a / -b)
        }
        if (d > 0) {
          j = Math.min(j, Math.floor(-c / d))
        }

        pivk[i] = utils.mod(k1 + j, n)
      }
    }

    j = pivk[n - 1]
    path.lon[n - 1] = j
    for (i = n - 2; i >= 0; i--) {
      if (utils.cyclic(i + 1, pivk[i], j)) {
        j = pivk[i]
      }
      path.lon[i] = j
    }

    for (i = n - 1; utils.cyclic(utils.mod(i + 1, n), j, path.lon[i]); i--) {
      path.lon[i] = j
    }
  }

  /**
   * Determines optimal polygon for path
   * @private
   * @param {Path} path - Path to optimize
   * @returns {void}
   */
  #best_polygon = path => {
    const penalty3 = (path, i, j) => {
      const n = path.len
      const pt = path.pt
      const sums = path.sums
      let x
      let y
      let xy
      let x2
      let y2
      let k
      let a
      let b
      let c
      let s
      let px
      let py
      let ex
      let ey
      let r = 0
      if (j >= n) {
        j -= n
        r = 1
      }

      if (r === 0) {
        x = sums[j + 1].x - sums[i].x
        y = sums[j + 1].y - sums[i].y
        x2 = sums[j + 1].x2 - sums[i].x2
        xy = sums[j + 1].xy - sums[i].xy
        y2 = sums[j + 1].y2 - sums[i].y2
        k = j + 1 - i
      } else {
        x = sums[j + 1].x - sums[i].x + sums[n].x
        y = sums[j + 1].y - sums[i].y + sums[n].y
        x2 = sums[j + 1].x2 - sums[i].x2 + sums[n].x2
        xy = sums[j + 1].xy - sums[i].xy + sums[n].xy
        y2 = sums[j + 1].y2 - sums[i].y2 + sums[n].y2
        k = j + 1 - i + n
      }

      px = (pt[i].x + pt[j].x) / 2.0 - pt[0].x
      py = (pt[i].y + pt[j].y) / 2.0 - pt[0].y
      ey = pt[j].x - pt[i].x
      ex = -(pt[j].y - pt[i].y)

      a = (x2 - 2 * x * px) / k + px * px
      b = (xy - x * py - y * px) / k + px * py
      c = (y2 - 2 * y * py) / k + py * py

      s = ex * ex * a + 2 * ex * ey * b + ey * ey * c

      return Math.sqrt(s)
    }

    let i
    let j
    let m
    let k
    let n = path.len
    let pen = []
    let prev = []
    let clip0 = []
    let clip1 = []
    const seg0 = []
    const seg1 = []
    let thispen
    let best
    let c

    for (i = 0; i < n; i++) {
      c = utils.mod(path.lon[utils.mod(i - 1, n)] - 1, n)
      if (c == i) {
        c = utils.mod(i + 1, n)
      }
      if (c < i) {
        clip0[i] = n
      } else {
        clip0[i] = c
      }
    }

    j = 1
    for (i = 0; i < n; i++) {
      while (j <= clip0[i]) {
        clip1[j] = i
        j++
      }
    }

    i = 0
    for (j = 0; i < n; j++) {
      seg0[j] = i
      i = clip0[i]
    }
    seg0[j] = n
    m = j

    i = n
    for (j = m; j > 0; j--) {
      seg1[j] = i
      i = clip1[i]
    }
    seg1[0] = 0

    pen[0] = 0
    for (j = 1; j <= m; j++) {
      for (i = seg1[j]; i <= seg0[j]; i++) {
        best = -1
        for (k = seg0[j - 1]; k >= clip1[i]; k--) {
          thispen = penalty3(path, k, i) + pen[k]
          if (best < 0 || thispen < best) {
            prev[i] = k
            best = thispen
          }
        }
        pen[i] = best
      }
    }
    path.m = m
    path.po = []

    for (i = n, j = m - 1; i > 0; j--) {
      i = prev[i]
      path.po[j] = i
    }
  }

  /**
   * Adjusts vertices of the path
   * @private
   * @param {Path} path - Path to adjust
   * @returns {void}
   */
  #adjust_vertices = path => {
    const pointslope = (path, i, j, ctr, dir) => {
      const n = path.len
      const sums = path.sums
      let x
      let y
      let x2
      let xy
      let y2
      let k
      let a
      let b
      let c
      let lambda2
      let l
      let r = 0

      while (j >= n) {
        j -= n
        r += 1
      }
      while (i >= n) {
        i -= n
        r -= 1
      }
      while (j < 0) {
        j += n
        r -= 1
      }
      while (i < 0) {
        i += n
        r += 1
      }

      x = sums[j + 1].x - sums[i].x + r * sums[n].x
      y = sums[j + 1].y - sums[i].y + r * sums[n].y
      x2 = sums[j + 1].x2 - sums[i].x2 + r * sums[n].x2
      xy = sums[j + 1].xy - sums[i].xy + r * sums[n].xy
      y2 = sums[j + 1].y2 - sums[i].y2 + sums[n].y2
      k = j + 1 - i + r * n

      ctr.x = x / k
      ctr.y = y / k

      a = (x2 - (x * x) / k) / k
      b = (xy - (x * y) / k) / k
      c = (y2 - (y * y) / k) / k

      lambda2 = (a + c + Math.sqrt((a - c) * (a - c) + 4 * b * b)) / 2

      a -= lambda2
      c -= lambda2

      if (Math.abs(a) >= Math.abs(c)) {
        l = Math.sqrt(a * a + b * b)
        if (l !== 0) {
          dir.x = -b / l
          dir.y = a / l
        }
      } else {
        l = Math.sqrt(c * c + b * b)
        if (l !== 0) {
          dir.x = -c / l
          dir.y = b / l
        }
      }
      if (l === 0) dir.x = dir.y = 0
    }

    const m = path.m
    const po = path.po
    const n = path.len
    const pt = path.pt
    const x0 = path.x0
    const y0 = path.y0
    const ctr = []
    const dir = []
    const q = []
    const v = []
    let d
    let i
    let j
    let k
    let l
    const s = new Point()

    path.curve = new Curve(m)

    for (i = 0; i < m; i++) {
      j = utils.mod(i + 1, m)
      j = utils.mod(j - po[i], n) + po[i]
      ctr[i] = new Point()
      dir[i] = new Point()
      pointslope(path, po[i], j, ctr[i], dir[i])
    }

    for (i = 0; i < m; i++) {
      q[i] = new Quad()
      d = dir[i].x * dir[i].x + dir[i].y * dir[i].y
      if (d === 0.0) {
        for (j = 0; j < 3; j++) {
          for (k = 0; k < 3; k++) {
            q[i].data[j * 3 + k] = 0
          }
        }
      } else {
        v[0] = dir[i].y
        v[1] = -dir[i].x
        v[2] = -v[1] * ctr[i].y - v[0] * ctr[i].x
        for (l = 0; l < 3; l++) {
          for (k = 0; k < 3; k++) {
            q[i].data[l * 3 + k] = (v[l] * v[k]) / d
          }
        }
      }
    }

    let Q
    let w
    let dx
    let dy
    let det
    let min
    let cand
    let xmin
    let ymin
    let z
    for (i = 0; i < m; i++) {
      Q = new Quad()
      w = new Point()

      s.x = pt[po[i]].x - x0
      s.y = pt[po[i]].y - y0

      j = utils.mod(i - 1, m)

      for (l = 0; l < 3; l++) {
        for (k = 0; k < 3; k++) {
          Q.data[l * 3 + k] = q[j].at(l, k) + q[i].at(l, k)
        }
      }

      while (1) {
        det = Q.at(0, 0) * Q.at(1, 1) - Q.at(0, 1) * Q.at(1, 0)
        if (det !== 0.0) {
          w.x = (-Q.at(0, 2) * Q.at(1, 1) + Q.at(1, 2) * Q.at(0, 1)) / det
          w.y = (Q.at(0, 2) * Q.at(1, 0) - Q.at(1, 2) * Q.at(0, 0)) / det
          break
        }

        if (Q.at(0, 0) > Q.at(1, 1)) {
          v[0] = -Q.at(0, 1)
          v[1] = Q.at(0, 0)
        }
        if (Q.at(1, 1)) {
          v[0] = -Q.at(1, 1)
          v[1] = Q.at(1, 0)
        }
        d = v[0] * v[0] + v[1] * v[1]
        v[2] = -v[1] * s.y - v[0] * s.x
        for (l = 0; l < 3; l++) {
          for (k = 0; k < 3; k++) {
            Q.data[l * 3 + k] += (v[l] * v[k]) / d
          }
        }
      }
      dx = Math.abs(w.x - s.x)
      dy = Math.abs(w.y - s.y)
      if (dx <= 0.5 && dy <= 0.5) {
        path.curve.vertex[i] = new Point(w.x + x0, w.y + y0)
        continue
      }

      min = utils.quadform(Q, s)
      xmin = s.x
      ymin = s.y

      if (Q.at(0, 0) !== 0.0) {
        for (z = 0; z < 2; z++) {
          w.y = s.y - 0.5 + z
          w.x = -(Q.at(0, 1) * w.y + Q.at(0, 2)) / Q.at(0, 0)
          dx = Math.abs(w.x - s.x)
          cand = utils.quadform(Q, w)
          if (dx <= 0.5 && cand < min) {
            min = cand
            xmin = w.x
            ymin = w.y
          }
        }
      }

      if (Q.at(1, 1) !== 0.0) {
        for (z = 0; z < 2; z++) {
          w.x = s.x - 0.5 + z
          w.y = -(Q.at(1, 0) * w.x + Q.at(1, 2)) / Q.at(1, 1)
          dy = Math.abs(w.y - s.y)
          cand = utils.quadform(Q, w)
          if (dy <= 0.5 && cand < min) {
            min = cand
            xmin = w.x
            ymin = w.y
          }
        }
      }

      for (l = 0; l < 2; l++) {
        for (k = 0; k < 2; k++) {
          w.x = s.x - 0.5 + l
          w.y = s.y - 0.5 + k
          cand = utils.quadform(Q, w)
          if (cand < min) {
            min = cand
            xmin = w.x
            ymin = w.y
          }
        }
      }

      path.curve.vertex[i] = new Point(xmin + x0, ymin + y0)
    }
  }

  /**
   * Reverses path direction
   * @private
   * @param {Path} path - Path to reverse
   * @returns {void}
   */
  #reverse = path => {
    const curve = path.curve
    const m = curve.n
    const v = curve.vertex
    let i
    let j
    let tmp

    for (i = 0, j = m - 1; i < j; i++, j--) {
      tmp = v[i]
      v[i] = v[j]
      v[j] = tmp
    }
  }

  /**
   * Smooths path curves
   * @private
   * @param {Path} path - Path to smooth
   * @returns {void}
   */
  #smooth = path => {
    const m = path.curve.n
    const curve = path.curve

    let i
    let j
    let k
    let dd
    let denom
    let alpha
    let p2
    let p3
    let p4

    for (i = 0; i < m; i++) {
      j = utils.mod(i + 1, m)
      k = utils.mod(i + 2, m)
      p4 = utils.interval(1 / 2.0, curve.vertex[k], curve.vertex[j])

      denom = utils.ddenom(curve.vertex[i], curve.vertex[k])
      if (denom !== 0.0) {
        dd =
          utils.dpara(curve.vertex[i], curve.vertex[j], curve.vertex[k]) / denom
        dd = Math.abs(dd)
        alpha = dd > 1 ? 1 - 1.0 / dd : 0
        alpha = alpha / 0.75
      } else {
        alpha = 4 / 3.0
      }
      curve.alpha0[j] = alpha

      if (alpha >= this.#params.alphaMax) {
        curve.tag[j] = 'CORNER'
        curve.c[3 * j + 1] = curve.vertex[j]
        curve.c[3 * j + 2] = p4
      } else {
        if (alpha < 0.55) {
          alpha = 0.55
        } else if (alpha > 1) {
          alpha = 1
        }
        p2 = utils.interval(0.5 + 0.5 * alpha, curve.vertex[i], curve.vertex[j])
        p3 = utils.interval(0.5 + 0.5 * alpha, curve.vertex[k], curve.vertex[j])
        curve.tag[j] = 'CURVE'
        curve.c[3 * j + 0] = p2
        curve.c[3 * j + 1] = p3
        curve.c[3 * j + 2] = p4
      }
      curve.alpha[j] = alpha
      curve.beta[j] = 0.5
    }
    curve.alpha_curve = 1
  }

  /**
   * Optimizes path curves
   * @private
   * @param {Path} path - Path to optimize
   * @returns {void}
   * @throws {Error} If path is invalid
   */
  #opti_curve = path => {
    const curve = path.curve
    const m = curve.n
    const vert = curve.vertex
    const pt = []
    const pen = []
    const len = []
    const opt = []
    let om
    let i
    let j
    let r
    let o = new Opti()
    let p0
    let i1
    let area
    let alpha
    let ocurve
    const s = []
    const t = []

    const convc = []
    const areac = []

    for (i = 0; i < m; i++) {
      if (curve.tag[i] == 'CURVE') {
        convc[i] = utils.sign(
          utils.dpara(
            vert[utils.mod(i - 1, m)],
            vert[i],
            vert[utils.mod(i + 1, m)]
          )
        )
      } else {
        convc[i] = 0
      }
    }

    area = 0.0
    areac[0] = 0.0
    p0 = curve.vertex[0]
    for (i = 0; i < m; i++) {
      i1 = utils.mod(i + 1, m)
      if (curve.tag[i1] == 'CURVE') {
        alpha = curve.alpha[i1]
        area +=
          (0.3 *
            alpha *
            (4 - alpha) *
            utils.dpara(curve.c[i * 3 + 2], vert[i1], curve.c[i1 * 3 + 2])) /
          2
        area += utils.dpara(p0, curve.c[i * 3 + 2], curve.c[i1 * 3 + 2]) / 2
      }
      areac[i + 1] = area
    }

    pt[0] = -1
    pen[0] = 0
    len[0] = 0

    for (j = 1; j <= m; j++) {
      pt[j] = j - 1
      pen[j] = pen[j - 1]
      len[j] = len[j - 1] + 1

      for (i = j - 2; i >= 0; i--) {
        r = this.#opti_penalty(
          path,
          i,
          utils.mod(j, m),
          o,
          this.#params.optTolerance,
          convc,
          areac
        )
        if (r) {
          break
        }
        if (
          len[j] > len[i] + 1 ||
          (len[j] == len[i] + 1 && pen[j] > pen[i] + o.pen)
        ) {
          pt[j] = i
          pen[j] = pen[i] + o.pen
          len[j] = len[i] + 1
          opt[j] = o
          o = new Opti()
        }
      }
    }
    om = len[m]
    ocurve = new Curve(om)

    j = m
    for (i = om - 1; i >= 0; i--) {
      if (pt[j] == j - 1) {
        ocurve.tag[i] = curve.tag[utils.mod(j, m)]
        ocurve.c[i * 3 + 0] = curve.c[utils.mod(j, m) * 3 + 0]
        ocurve.c[i * 3 + 1] = curve.c[utils.mod(j, m) * 3 + 1]
        ocurve.c[i * 3 + 2] = curve.c[utils.mod(j, m) * 3 + 2]
        ocurve.vertex[i] = curve.vertex[utils.mod(j, m)]
        ocurve.alpha[i] = curve.alpha[utils.mod(j, m)]
        ocurve.alpha0[i] = curve.alpha0[utils.mod(j, m)]
        ocurve.beta[i] = curve.beta[utils.mod(j, m)]
        s[i] = t[i] = 1.0
      } else {
        ocurve.tag[i] = 'CURVE'
        ocurve.c[i * 3 + 0] = opt[j].c[0]
        ocurve.c[i * 3 + 1] = opt[j].c[1]
        ocurve.c[i * 3 + 2] = curve.c[utils.mod(j, m) * 3 + 2]
        ocurve.vertex[i] = utils.interval(
          opt[j].s,
          curve.c[utils.mod(j, m) * 3 + 2],
          vert[utils.mod(j, m)]
        )
        ocurve.alpha[i] = opt[j].alpha
        ocurve.alpha0[i] = opt[j].alpha
        s[i] = opt[j].s
        t[i] = opt[j].t
      }
      j = pt[j]
    }

    for (i = 0; i < om; i++) {
      i1 = utils.mod(i + 1, om)
      ocurve.beta[i] = s[i] / (s[i] + t[i1])
    }

    ocurve.alpha_curve = 1
    path.curve = ocurve
  }

  /**
   * @private
   * @param {Path} path - Path to calculate sums for
   * @param {number} i - Start index
   * @param {number} j - End index
   * @param {Opti} res - Result object
   * @param {number} opttolerance - Optimization tolerance
   * @param {number[]} convc - Convexity array
   * @param {number[]} areac - Area array
   * @returns {0|1} Success flag
   */
  #opti_penalty(path, i, j, res, opttolerance, convc, areac) {
    const m = path.curve.n
    const curve = path.curve
    const vertex = curve.vertex
    let k
    let k1
    let k2
    let conv
    let i1
    let area
    let alpha
    let d
    let d1
    let d2
    let p0
    let p1
    let p2
    let p3
    let pt
    let A
    let R
    let A1
    let A2
    let A3
    let A4
    let s
    let t

    if (i == j) {
      return 1
    }

    k = i
    i1 = utils.mod(i + 1, m)
    k1 = utils.mod(k + 1, m)
    conv = convc[k1]
    if (conv === 0) {
      return 1
    }
    d = utils.ddist(vertex[i], vertex[i1])
    for (k = k1; k != j; k = k1) {
      k1 = utils.mod(k + 1, m)
      k2 = utils.mod(k + 2, m)
      if (convc[k1] != conv) {
        return 1
      }
      if (
        utils.sign(
          utils.cprod(vertex[i], vertex[i1], vertex[k1], vertex[k2])
        ) != conv
      ) {
        return 1
      }
      if (
        utils.iprod1(vertex[i], vertex[i1], vertex[k1], vertex[k2]) <
        d * utils.ddist(vertex[k1], vertex[k2]) * -0.999847695156
      ) {
        return 1
      }
    }

    p0 = curve.c[utils.mod(i, m) * 3 + 2].copy()
    p1 = vertex[utils.mod(i + 1, m)].copy()
    p2 = vertex[utils.mod(j, m)].copy()
    p3 = curve.c[utils.mod(j, m) * 3 + 2].copy()

    area = areac[j] - areac[i]
    area -= utils.dpara(vertex[0], curve.c[i * 3 + 2], curve.c[j * 3 + 2]) / 2
    if (i >= j) area += areac[m]

    A1 = utils.dpara(p0, p1, p2)
    A2 = utils.dpara(p0, p1, p3)
    A3 = utils.dpara(p0, p2, p3)

    A4 = A1 + A3 - A2

    if (A2 == A1) {
      return 1
    }

    t = A3 / (A3 - A4)
    s = A2 / (A2 - A1)
    A = (A2 * t) / 2.0

    if (A === 0.0) {
      return 1
    }

    R = area / A
    alpha = 2 - Math.sqrt(4 - R / 0.3)

    res.c[0] = utils.interval(t * alpha, p0, p1)
    res.c[1] = utils.interval(s * alpha, p3, p2)
    res.alpha = alpha
    res.t = t
    res.s = s

    p1 = res.c[0].copy()
    p2 = res.c[1].copy()

    res.pen = 0

    for (k = utils.mod(i + 1, m); k != j; k = k1) {
      k1 = utils.mod(k + 1, m)
      t = utils.tangent(p0, p1, p2, p3, vertex[k], vertex[k1])
      if (t < -0.5) {
        return 1
      }
      pt = utils.bezier(t, p0, p1, p2, p3)
      d = utils.ddist(vertex[k], vertex[k1])
      if (d === 0.0) {
        return 1
      }
      d1 = utils.dpara(vertex[k], vertex[k1], pt) / d
      if (Math.abs(d1) > opttolerance) {
        return 1
      }
      if (
        utils.iprod(vertex[k], vertex[k1], pt) < 0 ||
        utils.iprod(vertex[k1], vertex[k], pt) < 0
      ) {
        return 1
      }
      res.pen += d1 * d1
    }

    for (k = i; k != j; k = k1) {
      k1 = utils.mod(k + 1, m)
      t = utils.tangent(p0, p1, p2, p3, curve.c[k * 3 + 2], curve.c[k1 * 3 + 2])
      if (t < -0.5) {
        return 1
      }
      pt = utils.bezier(t, p0, p1, p2, p3)
      d = utils.ddist(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2])
      if (d === 0.0) {
        return 1
      }
      d1 = utils.dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], pt) / d
      d2 = utils.dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], vertex[k1]) / d
      d2 *= 0.75 * curve.alpha[k1]
      if (d2 < 0) {
        d1 = -d1
        d2 = -d2
      }
      if (d1 < d2 - opttolerance) {
        return 1
      }
      if (d1 < d2) res.pen += (d1 - d2) * (d1 - d2)
    }

    return 0
  }

  /**
   * Processes path list and creates optimized curves
   * @private
   * @returns {void}
   * @throws {Error} If pathlist is empty or invalid
   */
  #process_path() {
    for (let i = 0; i < this.#pathlist.length; i++) {
      const path = this.#pathlist[i]
      this.#calc_sums(path)
      this.#calc_lon(path)
      this.#best_polygon(path)
      this.#adjust_vertices(path)

      if (path.sign === '-') {
        this.#reverse(path)
      }

      this.#smooth(path)

      if (this.#params.optCurve) {
        this.#opti_curve(path)
      }
    }
  }

  /**
   * Validates parameters against constraints
   * @private
   * @param {Partial<PotraceOptions>} params - Parameters to validate
   * @throws {Error} If parameters are invalid with specific reason
   * @returns {void}
   */
  #validate_parameters(params) {
    if (
      params &&
      params.turnPolicy &&
      Potrace.supported_turn_policy_values.indexOf(params.turnPolicy) === -1
    ) {
      const goodVals =
        "'" + Potrace.supported_turn_policy_values.join("', '") + "'"

      throw new Error('Bad turnPolicy value. Allowed values are: ' + goodVals)
    }

    if (
      params &&
      params.threshold != null &&
      params.threshold !== Potrace.THRESHOLD_AUTO
    ) {
      if (
        typeof params.threshold !== 'number' ||
        !utils.between(params.threshold, 0, 255)
      ) {
        throw new Error(
          'Bad threshold value. Expected to be an integer in range 0..255'
        )
      }
    }

    if (
      params &&
      params.optCurve != null &&
      typeof params.optCurve !== 'boolean'
    ) {
      throw new Error("'optCurve' must be Boolean")
    }
  }

  /**
   * @private
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {void}
   * @description Processes raw image data into a bitmap by converting RGB values to luminance
   */
  #process_loaded_image(image_data) {
    const canvas = new OffscreenCanvas(image_data.width, image_data.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Draw and get image data with optimized reading
    ctx.putImageData(image_data, 0, 0)
    const optimized_data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = optimized_data.data

    const bitmap = new Bitmap(image_data.width, image_data.height)

    for (let i = 0; i < pixels.length; i += 4) {
      const opacity = pixels[i + 3] / 255
      const r = 255 + (pixels[i + 0] - 255) * opacity
      const g = 255 + (pixels[i + 1] - 255) * opacity
      const b = 255 + (pixels[i + 2] - 255) * opacity

      bitmap.data[i / 4] = utils.luminance(r, g, b)
    }

    this.#luminance_data = bitmap
    this.#image_loaded = true
  }

  /**
   * @private
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {void}
   */
  #load_image(image_data) {
    this.#image_loading_identifier = {}
    this.#image_loaded = false

    this.#image_loading_identifier = null
    this.#image_loaded = true
    this.#process_loaded_image(image_data)
  }

  /**
   * @private
   * @param {PotraceOptions} newParams - New parameters to validate and set
   * @throws {Error} If parameters are invalid
   * @returns {void}
   */
  #set_parameters(newParams) {
    this.#validate_parameters(newParams)

    for (let key in this.#params) {
      if (this.#params.hasOwnProperty(key) && newParams.hasOwnProperty(key)) {
        const tmpOldVal = this.#params[key]
        this.#params[key] = newParams[key]

        if (
          tmpOldVal !== this.#params[key] &&
          ['color', 'background'].indexOf(key) === -1
        ) {
          this.#processed = false
        }
      }
    }

    if (
      this.#params.steps &&
      !Array.isArray(this.#params.steps) &&
      (!utils.is_number(this.#params.steps) ||
        !utils.between(this.#params.steps, 1, 255))
    ) {
      throw new Error("Bad 'steps' value")
    }

    this.#calculated_threshold = null
  }

  /**
   * Gets path tag for SVG output
   * @param {string} [fillColor] - Override fill color (any valid CSS color)
   * @returns {string} SVG path tag
   * @throws {Error} If image not loaded
   */
  get_path_tag(fillColor) {
    fillColor = arguments.length === 0 ? this.#params.color : fillColor

    if (fillColor === Potrace.COLOR_AUTO) {
      fillColor = this.#params.blackOnWhite ? 'black' : 'white'
    }

    if (!this.#image_loaded) {
      throw new Error('Image should be loaded first')
    }

    if (!this.#processed) {
      this.#bitmap_to_pathlist()
      this.#process_path()
      this.#processed = true
    }

    let tag = '<path itemprop="path" d="'

    this.#pathlist.forEach(path => {
      tag += utils.render_curve(path.curve, 1)
    })

    tag += '" style="fill-rule:evenodd"/>'

    return tag
  }

  /**
   * Gets path data for SVG output
   * @param {string} [fillColor] - Override fill color (any valid CSS color)
   * @returns {string} SVG path data string
   * @throws {Error} If image not loaded
   */
  get_path_data(fillColor) {
    fillColor = arguments.length === 0 ? this.#params.color : fillColor

    if (fillColor === Potrace.COLOR_AUTO) {
      fillColor = this.#params.blackOnWhite ? 'black' : 'white'
    }

    if (!this.#image_loaded) {
      throw new Error('Image should be loaded first')
    }

    if (!this.#processed) {
      this.#bitmap_to_pathlist()
      this.#process_path()
      this.#processed = true
    }

    let tag = ''

    this.#pathlist.forEach(path => {
      tag += utils.render_curve(path.curve, 1)
    })

    return tag
  }

  /**
   * @private
   * @param {Array<{value: number, colorIntensity: number}>} ranges - Current color ranges
   * @returns {Array<{value: number, colorIntensity: number}>} Modified color ranges
   */
  #add_extra_color_stop(ranges) {
    const blackOnWhite = this.#params.blackOnWhite
    const lastColorStop = ranges[ranges.length - 1]
    const lastRangeFrom = blackOnWhite ? 0 : lastColorStop.value
    const lastRangeTo = blackOnWhite ? lastColorStop.value : 255

    if (
      lastRangeTo - lastRangeFrom > 25 &&
      lastColorStop.colorIntensity !== 1
    ) {
      const histogram = this.#get_image_histogram()
      const levels = histogram.get_stats(lastRangeFrom, lastRangeTo).levels

      const newColorStop =
        levels.mean + levels.stdDev <= 25
          ? levels.mean + levels.stdDev
          : levels.mean - levels.stdDev <= 25
            ? levels.mean - levels.stdDev
            : 25

      const newStats = blackOnWhite
        ? histogram.get_stats(0, newColorStop)
        : histogram.get_stats(newColorStop, 255)
      const color = newStats.levels.mean

      ranges.push({
        value: Math.abs((blackOnWhite ? 0 : 255) - newColorStop),
        colorIntensity: isNaN(color)
          ? 0
          : (blackOnWhite ? 255 - color : color) / 255
      })
    }

    return ranges
  }

  /**
   * @private
   * @param {number[]} colorStops - Array of threshold values
   * @returns {Array<{value: number, colorIntensity: number}>} Color stops with calculated intensities
   */
  #calc_color_intensity(colorStops) {
    const blackOnWhite = this.#params.blackOnWhite
    const colorSelectionStrat = this.#params.fillStrategy
    const histogram =
      colorSelectionStrat !== Potrace.FILL_SPREAD
        ? this.#get_image_histogram()
        : null
    const fullRange = Math.abs(
      this.#params.threshold - (blackOnWhite ? 0 : 255)
    )

    return colorStops.map((threshold, index) => {
      const nextValue =
        index + 1 === colorStops.length
          ? blackOnWhite
            ? -1
            : 256
          : colorStops[index + 1]
      const rangeStart = Math.round(blackOnWhite ? nextValue + 1 : threshold)
      const rangeEnd = Math.round(blackOnWhite ? threshold : nextValue - 1)
      const factor = index / (colorStops.length - 1)
      const intervalSize = rangeEnd - rangeStart
      const stats = histogram.get_stats(rangeStart, rangeEnd)
      let color = -1

      if (stats.pixels === 0) {
        return {
          value: threshold,
          colorIntensity: 0
        }
      }

      switch (colorSelectionStrat) {
        case Potrace.FILL_SPREAD:
          // We want it to be 0 (255 when white on black) at the most saturated end, so...
          color =
            (blackOnWhite ? rangeStart : rangeEnd) +
            (blackOnWhite ? 1 : -1) *
              intervalSize *
              Math.max(0.5, fullRange / 255) *
              factor
          break
        case Potrace.FILL_DOMINANT:
          color = histogram.get_dominant_color(
            rangeStart,
            rangeEnd,
            utils.clamp(intervalSize, 1, 5)
          )
          break
        case Potrace.FILL_MEAN:
          color = stats.levels.mean
          break
        case Potrace.FILL_MEDIAN:
          color = stats.levels.median
          break
      }

      // We don't want colors to be too close to each other, so we introduce some spacing in between
      if (index !== 0) {
        color = blackOnWhite
          ? utils.clamp(
              color,
              rangeStart,
              rangeEnd - Math.round(intervalSize * 0.1)
            )
          : utils.clamp(
              color,
              rangeStart + Math.round(intervalSize * 0.1),
              rangeEnd
            )
      }

      return {
        value: threshold,
        colorIntensity:
          color === -1 ? 0 : (blackOnWhite ? 255 - color : color) / 255
      }
    })
  }

  /**
   * @private
   * @returns {import('./types/Histogram')} Image histogram
   */
  #get_image_histogram() {
    return this.#luminance_data.histogram()
  }

  /**
   * Gets ranges for posterization
   * @private
   * @returns {Array<Object>} Color ranges
   */
  #get_ranges() {
    const steps = this.#param_steps()

    if (!Array.isArray(steps)) {
      return this.#params.rangeDistribution === Potrace.RANGES_AUTO
        ? this.#get_ranges_auto()
        : this.#get_ranges_equally_distributed()
    }

    let colorStops = []
    const threshold = this.#param_threshold()
    const lookingForDarkPixels = this.#params.blackOnWhite

    steps.forEach(item => {
      if (colorStops.indexOf(item) === -1 && utils.between(item, 0, 255))
        colorStops.push(item)
    })

    if (!colorStops.length) {
      colorStops.push(threshold)
    }

    colorStops = colorStops.sort((a, b) =>
      a < b === lookingForDarkPixels ? 1 : -1
    )

    if (lookingForDarkPixels && colorStops[0] < threshold) {
      colorStops.unshift(threshold)
    } else if (
      !lookingForDarkPixels &&
      colorStops[colorStops.length - 1] < threshold
    ) {
      colorStops.push(threshold)
    }

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * Gets auto-calculated ranges
   * @private
   * @returns {Array<Object>} Auto-calculated ranges
   */
  #get_ranges_auto() {
    const histogram = this.#get_image_histogram()
    const steps = this.#param_steps(true)
    let colorStops

    if (this.#params.threshold === Potrace.THRESHOLD_AUTO) {
      colorStops = histogram.multilevel_thresholding(steps)
    } else {
      const threshold = this.#param_threshold()

      colorStops = this.#params.blackOnWhite
        ? histogram.multilevel_thresholding(steps - 1, 0, threshold)
        : histogram.multilevel_thresholding(steps - 1, threshold, 255)

      if (this.#params.blackOnWhite) {
        colorStops.push(threshold)
      } else {
        colorStops.unshift(threshold)
      }
    }

    if (this.#params.blackOnWhite) {
      colorStops = colorStops.reverse()
    }

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * Gets equally distributed ranges
   * @private
   * @returns {Array<Object>} Equally distributed ranges
   */
  #get_ranges_equally_distributed() {
    const blackOnWhite = this.#params.blackOnWhite
    const colorsToThreshold = blackOnWhite
      ? this.#param_threshold()
      : 255 - this.#param_threshold()
    const steps = this.#param_steps()

    const stepSize = colorsToThreshold / steps
    const colorStops = []
    let i = steps - 1

    while (i >= 0) {
      const factor = i / (steps - 1)
      const threshold = Math.min(colorsToThreshold, (i + 1) * stepSize)
      const finalThreshold = blackOnWhite ? threshold : 255 - threshold
      i--

      colorStops.push(finalThreshold)
    }

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * @private
   * @param {boolean} [count=false] - Return count instead of steps
   * @returns {number|number[]} Steps value or count
   */
  #param_steps(count) {
    const steps = this.#params.steps

    if (Array.isArray(steps)) {
      return count ? steps.length : steps
    }

    if (
      steps === Potrace.STEPS_AUTO &&
      this.#params.threshold === Potrace.THRESHOLD_AUTO
    ) {
      return 4
    }

    const blackOnWhite = this.#params.blackOnWhite
    const colorsCount = blackOnWhite
      ? this.#param_threshold()
      : 255 - this.#param_threshold()

    return steps === Potrace.STEPS_AUTO
      ? colorsCount > 200
        ? 4
        : 3
      : Math.min(colorsCount, Math.max(2, steps))
  }

  /**
   * Gets valid threshold parameter
   * @private
   * @returns {number} Threshold value
   */
  #param_threshold() {
    if (this.#calculated_threshold !== null) {
      return this.#calculated_threshold
    }

    if (this.#params.threshold !== Potrace.THRESHOLD_AUTO) {
      this.#calculated_threshold = this.#params.threshold
      return this.#calculated_threshold
    }

    const twoThresholds = this.#get_image_histogram().multilevel_thresholding(2)
    this.#calculated_threshold = this.#params.blackOnWhite
      ? twoThresholds[1]
      : twoThresholds[0]
    this.#calculated_threshold = this.#calculated_threshold || 128

    return this.#calculated_threshold
  }

  /**
   * @private
   * @param {boolean} [noFillColor=false] - Skip fill color
   * @returns {string[]} Array of path tags
   */
  #path_tags(noFillColor) {
    let ranges = this.#get_ranges()
    const blackOnWhite = this.#params.blackOnWhite

    if (ranges.length >= 10) {
      ranges = this.#add_extra_color_stop(ranges)
    }

    this.#set_parameters({ blackOnWhite })

    let actualPrevLayersOpacity = 0

    return ranges.map(colorStop => {
      const thisLayerOpacity = colorStop.colorIntensity

      if (thisLayerOpacity === 0) {
        return ''
      }

      const calculatedOpacity =
        !actualPrevLayersOpacity || thisLayerOpacity === 1
          ? thisLayerOpacity
          : (actualPrevLayersOpacity - thisLayerOpacity) /
            (actualPrevLayersOpacity - 1)

      calculatedOpacity = utils.clamp(
        parseFloat(calculatedOpacity.toFixed(3)),
        0,
        1
      )
      actualPrevLayersOpacity =
        actualPrevLayersOpacity +
        (1 - actualPrevLayersOpacity) * calculatedOpacity

      this.#set_parameters({ threshold: colorStop.value })

      let element = noFillColor ? this.get_path_tag('') : this.get_path_tag()
      element = utils.set_html_attr(
        element,
        'fill-opacity',
        calculatedOpacity.toFixed(3)
      )

      const canBeIgnored =
        calculatedOpacity === 0 || element.indexOf(' d=""') !== -1

      const c = Math.round(
        Math.abs((blackOnWhite ? 255 : 0) - 255 * thisLayerOpacity)
      )
      element = utils.set_html_attr(
        element,
        'fill',
        'rgb(' + c + ', ' + c + ', ' + c + ')'
      )

      return canBeIgnored ? '' : element
    })
  }

  /**
   * Converts the loaded image into an array of curve paths
   * @returns {PathData[]} Array of path objects with SVG path data and opacity
   * @throws {Error} If image not loaded
   */
  as_curves() {
    const ranges = this.#get_ranges()
    const blackOnWhite = this.#params.blackOnWhite

    this.#set_parameters({ blackOnWhite })

    let actualPrevLayersOpacity = 0

    return ranges.map(colorStop => {
      const thisLayerOpacity = colorStop.colorIntensity

      if (thisLayerOpacity === 0) return ''

      let calculatedOpacity =
        !actualPrevLayersOpacity || thisLayerOpacity === 1
          ? thisLayerOpacity
          : (actualPrevLayersOpacity - thisLayerOpacity) /
            (actualPrevLayersOpacity - 1)

      calculatedOpacity = utils.clamp(
        parseFloat(calculatedOpacity.toFixed(3)),
        0,
        1
      )
      actualPrevLayersOpacity =
        actualPrevLayersOpacity +
        (1 - actualPrevLayersOpacity) * calculatedOpacity

      this.#set_parameters({ threshold: colorStop.value })

      return {
        d: this.get_path_data(),
        fillOpacity: calculatedOpacity.toFixed(3)
      }
    })
  }

  /**
   * Creates paths from image data
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {ProcessedPaths} Processed path data
   * @throws {Error} If image cannot be processed
   */
  create_paths(image_data) {
    this.#load_image(image_data)
    const width = this.#luminance_data.width
    const height = this.#luminance_data.height
    const dark = !this.#params.black_on_white
    const paths = this.as_curves()
    return { width, height, dark, paths }
  }
}

export default {
  as_paths,
  Potrace
}
