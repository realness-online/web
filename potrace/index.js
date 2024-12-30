import Jimp from 'jimp'
import Curve from '@/potrace/types/Curve'
import Point from '@/potrace/types/Point'
import Path from '@/potrace/types/Path'
import Quad from '@/potrace/types/Quad'
import Sum from '@/potrace/types/Sum'
import Opti from '@/potrace/types/Opti'
import utils from '@/potrace/utils'
import Bitmap from '@/potrace/types/Bitmap'

/**
 * Converts an image into SVG paths
 * @async
 * @param {string|Buffer|Jimp} file - Image source (buffer, local path or url). Supports PNG, JPEG or BMP
 * @param {Object} [options={}] - Potrace options
 * @param {string} [options.turnPolicy='minority'] - How to resolve ambiguities in path decomposition
 * @param {number} [options.turdSize=2] - Suppress speckles of up to this size
 * @param {number} [options.alphaMax=1] - Corner threshold parameter
 * @param {boolean} [options.optCurve=true] - Curve optimization
 * @param {number} [options.optTolerance=0.2] - Curve optimization tolerance
 * @param {number} [options.threshold=AUTO] - Threshold below which color is considered black (0-255)
 * @param {boolean} [options.blackOnWhite=true] - Specifies which side of threshold to trace
 * @returns {Promise<Object>} - Resolution object containing width, height, dark flag and paths
 */
export const as_paths = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    var potrace = new Potrace(options)
    potrace.load_image(file, error => {
      if (error) reject(error)
      const width = potrace._luminance_data.width
      const height = potrace._luminance_data.height
      const dark = !potrace._params.black_on_white
      const paths = potrace.as_curves()
      resolve({ width, height, dark, paths })
    })
  })
}

/**
 * Potrace class for converting bitmap images to vector graphics
 * @class Potrace
 * @classdesc Implements the Potrace algorithm for tracing bitmap images into vector graphics
 *
 * @typedef {Object} PotraceOptions
 * @property {string} [turnPolicy='minority'] - How to resolve ambiguities in path decomposition
 *    One of: 'black', 'white', 'left', 'right', 'minority', 'majority'
 * @property {number} [turdSize=2] - Suppress speckles of up to this size
 * @property {number} [alphaMax=1] - Corner threshold parameter
 * @property {boolean} [optCurve=true] - Enable/disable curve optimization
 * @property {number} [optTolerance=0.2] - Curve optimization tolerance
 * @property {number} [threshold=THRESHOLD_AUTO] - Threshold below which color is considered black (0-255)
 * @property {boolean} [blackOnWhite=true] - Specifies which side of threshold to trace
 * @property {string} [color='auto'] - Foreground color ('auto', 'black', 'white', or any CSS color)
 * @property {string} [background='transparent'] - Background color
 *
 * @requires {@link https://www.npmjs.com/package/jimp|Jimp}
 */
class Potrace {
  static COLOR_AUTO = 'auto'
  static COLOR_TRANSPARENT = 'transparent'
  static THRESHOLD_AUTO = -1

  static STEPS_AUTO = -1
  static FILL_SPREAD = 'spread'
  static FILL_DOMINANT = 'dominant'
  static FILL_MEDIAN = 'median'
  static FILL_MEAN = 'mean'
  static RANGES_AUTO = 'auto'
  static RANGES_EQUAL = 'equal'

  static turn_policy = {
    black: 'black',
    white: 'white',
    left: 'left',
    right: 'right',
    minority: 'minority',
    majority: 'majority'
  }
  static supported_turn_policy_values = Object.values(Potrace.turn_policy)
  _luminance_data = null
  _pathlist = []
  _image_loading_identifier = null
  _image_loaded = false
  _processed = false

  _params = {
    turnPolicy: Potrace.turn_policy.minority,
    turdSize: 2,
    alphaMax: 1,
    optCurve: true,
    optTolerance: 0.2,
    threshold: Potrace.THRESHOLD_AUTO,
    blackOnWhite: true,
    color: Potrace.COLOR_AUTO,
    background: Potrace.COLOR_TRANSPARENT,
    blackOnWhite: true,
    steps: Potrace.STEPS_AUTO,
    fillStrategy: Potrace.FILL_DOMINANT,
    rangeDistribution: Potrace.RANGES_AUTO
  }

  constructor(options) {
    if (options) {
      this.set_parameters(options)
    }
    if (this._params.steps) {
      this._calculated_threshold = null
    }
  }

  /**
   * Creates path list from bitmap data
   * @private
   */
  _bm_to_pathlist() {
    var self = this
    var threshold = this._params.threshold
    var blackOnWhite = this._params.blackOnWhite
    var blackMap
    var currentPoint = new Point(0, 0)
    var path

    if (threshold === Potrace.THRESHOLD_AUTO) {
      threshold = this._luminance_data.histogram().autoThreshold() || 128
    }

    blackMap = this._luminance_data.copy(function (lum) {
      var pastTheThreshold = blackOnWhite ? lum > threshold : lum < threshold

      return pastTheThreshold ? 0 : 1
    })

    /**
     * Finds next black pixel in the bitmap
     * @private
     * @param {Point} point - Starting point
     * @returns {boolean|Point} False if no pixel found, or Point object
     */
    function findNext(point) {
      var i = blackMap.pointToIndex(point)

      while (i < blackMap.size && blackMap.data[i] !== 1) {
        i++
      }

      return i < blackMap.size && blackMap.indexToPoint(i)
    }

    function majority(x, y) {
      var i
      var a
      var ct

      for (i = 2; i < 5; i++) {
        ct = 0
        for (a = -i + 1; a <= i - 1; a++) {
          ct += blackMap.getValueAt(x + a, y + i - 1) ? 1 : -1
          ct += blackMap.getValueAt(x + i - 1, y + a - 1) ? 1 : -1
          ct += blackMap.getValueAt(x + a - 1, y - i) ? 1 : -1
          ct += blackMap.getValueAt(x - i, y + a) ? 1 : -1
        }

        if (ct > 0) {
          return 1
        } else if (ct < 0) {
          return 0
        }
      }
      return 0
    }

    /**
     * Traces a path from given point
     * @private
     * @param {Point} point - Starting point
     * @returns {Path} Traced path object
     */
    function findPath(point) {
      var path = new Path()
      var x = point.x
      var y = point.y
      var dirx = 0
      var diry = 1
      var tmp

      path.sign = blackMap.getValueAt(point.x, point.y) ? '+' : '-'

      while (1) {
        path.pt.push(new Point(x, y))
        if (x > path.maxX) path.maxX = x
        if (x < path.minX) path.minX = x
        if (y > path.maxY) path.maxY = y
        if (y < path.minY) path.minY = y
        path.len++

        x += dirx
        y += diry
        path.area -= x * diry

        if (x === point.x && y === point.y) break

        var l = blackMap.getValueAt(
          x + (dirx + diry - 1) / 2,
          y + (diry - dirx - 1) / 2
        )
        var r = blackMap.getValueAt(
          x + (dirx - diry - 1) / 2,
          y + (diry + dirx - 1) / 2
        )

        if (r && !l) {
          if (
            self._params.turnPolicy === Potrace.turn_policy.right ||
            (self._params.turnPolicy === Potrace.turn_policy.black &&
              path.sign === '+') ||
            (self._params.turnPolicy === Potrace.turn_policy.white &&
              path.sign === '-') ||
            (self._params.turnPolicy === Potrace.turn_policy.majority &&
              majority(x, y)) ||
            (self._params.turnPolicy === Potrace.turn_policy.minority &&
              !majority(x, y))
          ) {
            tmp = dirx
            dirx = -diry
            diry = tmp
          } else {
            tmp = dirx
            dirx = diry
            diry = -tmp
          }
        } else if (r) {
          tmp = dirx
          dirx = -diry
          diry = tmp
        } else if (!l) {
          tmp = dirx
          dirx = diry
          diry = -tmp
        }
      }
      return path
    }

    /**
     * XOR operation on path pixels
     * @private
     * @param {Path} path - Path to XOR
     */
    function xorPath(path) {
      var y1 = path.pt[0].y
      var len = path.len
      var x
      var y
      var maxX
      var minY
      var i
      var j
      var indx

      for (i = 1; i < len; i++) {
        x = path.pt[i].x
        y = path.pt[i].y

        if (y !== y1) {
          minY = y1 < y ? y1 : y
          maxX = path.maxX
          for (j = x; j < maxX; j++) {
            indx = blackMap.pointToIndex(j, minY)
            blackMap.data[indx] = blackMap.data[indx] ? 0 : 1
          }
          y1 = y
        }
      }
    }

    // Clear path list
    this._pathlist = []

    while ((currentPoint = findNext(currentPoint))) {
      path = findPath(currentPoint)
      xorPath(path)

      if (path.area > self._params.turdSize) {
        this._pathlist.push(path)
      }
    }
  }

  /**
   * Processes path list created by _bm_to_pathlist method creating and optimizing {@link Curve}'s
   * @private
   */
  _process_path() {
    var self = this

    /**
     * Calculates sums for path optimization
     * @private
     * @param {Path} path - Path to calculate sums for
     */
    function calcSums(path) {
      var i
      var x
      var y
      path.x0 = path.pt[0].x
      path.y0 = path.pt[0].y

      path.sums = []
      var s = path.sums
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
     */
    function calcLon(path) {
      var n = path.len
      var pt = path.pt
      var dir
      var pivk = new Array(n)
      var nc = new Array(n)
      var ct = new Array(4)

      path.lon = new Array(n)

      var constraint = [new Point(), new Point()],
        cur = new Point(),
        off = new Point(),
        dk = new Point(),
        foundk

      var i
      var j
      var k1
      var a
      var b
      var c
      var d
      var k = 0
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
          if (!utils.cyclic(k, i, k1)) {
            break
          }
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
     */
    function bestPolygon(path) {
      function penalty3(path, i, j) {
        var n = path.len
        var pt = path.pt
        var sums = path.sums
        var x
        var y
        var xy
        var x2
        var y2
        var k
        var a
        var b
        var c
        var s
        var px
        var py
        var ex
        var ey
        var r = 0
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

      var i
      var j
      var m
      var k
      var n = path.len
      var pen = new Array(n + 1)
      var prev = new Array(n + 1)
      var clip0 = new Array(n)
      var clip1 = new Array(n + 1)
      var seg0 = new Array(n + 1)
      var seg1 = new Array(n + 1)
      var thispen
      var best
      var c

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
      path.po = new Array(m)

      for (i = n, j = m - 1; i > 0; j--) {
        i = prev[i]
        path.po[j] = i
      }
    }

    /**
     * Adjusts vertices of the path
     * @private
     * @param {Path} path - Path to adjust
     */
    function adjustVertices(path) {
      function pointslope(path, i, j, ctr, dir) {
        var n = path.len
        var sums = path.sums
        var x
        var y
        var x2
        var xy
        var y2
        var k
        var a
        var b
        var c
        var lambda2
        var l
        var r = 0

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
        y2 = sums[j + 1].y2 - sums[i].y2 + r * sums[n].y2
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
        if (l === 0) {
          dir.x = dir.y = 0
        }
      }

      var m = path.m
      var po = path.po
      var n = path.len
      var pt = path.pt
      var x0 = path.x0
      var y0 = path.y0
      var ctr = new Array(m)
      var dir = new Array(m)
      var q = new Array(m)
      var v = new Array(3)
      var d
      var i
      var j
      var k
      var l
      var s = new Point()

      path.curve = new Curve(m)

      for (i = 0; i < m; i++) {
        j = po[utils.mod(i + 1, m)]
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

      var Q
      var w
      var dx
      var dy
      var det
      var min
      var cand
      var xmin
      var ymin
      var z
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
          } else if (Q.at(1, 1)) {
            v[0] = -Q.at(1, 1)
            v[1] = Q.at(1, 0)
          } else {
            v[0] = 1
            v[1] = 0
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
     */
    function reverse(path) {
      var curve = path.curve
      var m = curve.n
      var v = curve.vertex
      var i
      var j
      var tmp

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
     */
    function smooth(path) {
      var m = path.curve.n
      var curve = path.curve

      var i
      var j
      var k
      var dd
      var denom
      var alpha
      var p2
      var p3
      var p4

      for (i = 0; i < m; i++) {
        j = utils.mod(i + 1, m)
        k = utils.mod(i + 2, m)
        p4 = utils.interval(1 / 2.0, curve.vertex[k], curve.vertex[j])

        denom = utils.ddenom(curve.vertex[i], curve.vertex[k])
        if (denom !== 0.0) {
          dd =
            utils.dpara(curve.vertex[i], curve.vertex[j], curve.vertex[k]) /
            denom
          dd = Math.abs(dd)
          alpha = dd > 1 ? 1 - 1.0 / dd : 0
          alpha = alpha / 0.75
        } else {
          alpha = 4 / 3.0
        }
        curve.alpha0[j] = alpha

        if (alpha >= self._params.alphaMax) {
          curve.tag[j] = 'CORNER'
          curve.c[3 * j + 1] = curve.vertex[j]
          curve.c[3 * j + 2] = p4
        } else {
          if (alpha < 0.55) {
            alpha = 0.55
          } else if (alpha > 1) {
            alpha = 1
          }
          p2 = utils.interval(
            0.5 + 0.5 * alpha,
            curve.vertex[i],
            curve.vertex[j]
          )
          p3 = utils.interval(
            0.5 + 0.5 * alpha,
            curve.vertex[k],
            curve.vertex[j]
          )
          curve.tag[j] = 'CURVE'
          curve.c[3 * j + 0] = p2
          curve.c[3 * j + 1] = p3
          curve.c[3 * j + 2] = p4
        }
        curve.alpha[j] = alpha
        curve.beta[j] = 0.5
      }
      curve.alphaCurve = 1
    }

    /**
     * Optimizes path curves
     * @private
     * @param {Path} path - Path to optimize
     */
    function optiCurve(path) {
      function opti_penalty(path, i, j, res, opttolerance, convc, areac) {
        var m = path.curve.n
        var curve = path.curve
        var vertex = curve.vertex
        var k
        var k1
        var k2
        var conv
        var i1
        var area
        var alpha
        var d
        var d1
        var d2
        var p0
        var p1
        var p2
        var p3
        var pt
        var A
        var R
        var A1
        var A2
        var A3
        var A4
        var s
        var t

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
        area -=
          utils.dpara(vertex[0], curve.c[i * 3 + 2], curve.c[j * 3 + 2]) / 2
        if (i >= j) {
          area += areac[m]
        }

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
          t = utils.tangent(
            p0,
            p1,
            p2,
            p3,
            curve.c[k * 3 + 2],
            curve.c[k1 * 3 + 2]
          )
          if (t < -0.5) {
            return 1
          }
          pt = utils.bezier(t, p0, p1, p2, p3)
          d = utils.ddist(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2])
          if (d === 0.0) {
            return 1
          }
          d1 = utils.dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], pt) / d
          d2 =
            utils.dpara(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], vertex[k1]) / d
          d2 *= 0.75 * curve.alpha[k1]
          if (d2 < 0) {
            d1 = -d1
            d2 = -d2
          }
          if (d1 < d2 - opttolerance) {
            return 1
          }
          if (d1 < d2) {
            res.pen += (d1 - d2) * (d1 - d2)
          }
        }

        return 0
      }

      var curve = path.curve
      var m = curve.n
      var vert = curve.vertex
      var pt = new Array(m + 1)
      var pen = new Array(m + 1)
      var len = new Array(m + 1)
      var opt = new Array(m + 1)
      var om
      var i
      var j
      var r
      var o = new Opti()
      var p0
      var i1
      var area
      var alpha
      var ocurve
      var s
      var t

      var convc = new Array(m)
      var areac = new Array(m + 1)

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
          r = opti_penalty(
            path,
            i,
            utils.mod(j, m),
            o,
            self._params.optTolerance,
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
      s = new Array(om)
      t = new Array(om)

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

      ocurve.alphaCurve = 1
      path.curve = ocurve
    }

    for (var i = 0; i < this._pathlist.length; i++) {
      var path = this._pathlist[i]
      calcSums(path)
      calcLon(path)
      bestPolygon(path)
      adjustVertices(path)

      if (path.sign === '-') {
        reverse(path)
      }

      smooth(path)

      if (self._params.optCurve) {
        optiCurve(path)
      }
    }
  }

  /**
   * Validates parameters
   * @private
   * @param {Object} params - Parameters to validate
   * @throws {Error} If parameters are invalid
   */
  _validate_parameters(params) {
    if (
      params &&
      params.turnPolicy &&
      Potrace.supported_turn_policy_values.indexOf(params.turnPolicy) === -1
    ) {
      var goodVals =
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
   * Processes loaded image data
   * @private
   * @param {Jimp} image - Loaded image
   */
  _process_loaded_image(image) {
    var bitmap = new Bitmap(image.bitmap.width, image.bitmap.height)
    var pixels = image.bitmap.data

    image.scan(
      0,
      0,
      image.bitmap.width,
      image.bitmap.height,
      function (x, y, idx) {
        // We want background underneath non-opaque regions to be white

        var opacity = pixels[idx + 3] / 255,
          r = 255 + (pixels[idx + 0] - 255) * opacity,
          g = 255 + (pixels[idx + 1] - 255) * opacity,
          b = 255 + (pixels[idx + 2] - 255) * opacity

        bitmap.data[idx / 4] = utils.luminance(r, g, b)
      }
    )

    this._luminance_data = bitmap
    this._image_loaded = true
  }

  /**
   * @param {Jimp} target Image source. Could be anything that {@link Jimp} Supported formats are: PNG, JPEG or BMP
   * @param {Function} callback
   */
  load_image(target, callback) {
    var self = this
    var jobId = {}

    this._image_loading_identifier = jobId
    this._image_loaded = false

    // target instanceof Jimp
    this._image_loading_identifier = null
    this._image_loaded = true
    self._process_loaded_image(target)
    callback.call(self, null)
  }

  /**
   * Sets algorithm parameters
   * @param {Potrace~Options} newParams
   */
  set_parameters(newParams) {
    var key
    var tmpOldVal
    this._validate_parameters(newParams)

    for (key in this._params) {
      if (this._params.hasOwnProperty(key) && newParams.hasOwnProperty(key)) {
        tmpOldVal = this._params[key]
        this._params[key] = newParams[key]

        if (
          tmpOldVal !== this._params[key] &&
          ['color', 'background'].indexOf(key) === -1
        ) {
          this._processed = false
        }
      }
    }

    if (
      this._params.steps &&
      !Array.isArray(this._params.steps) &&
      (!utils.isNumber(this._params.steps) ||
        !utils.between(this._params.steps, 1, 255))
    ) {
      throw new Error("Bad 'steps' value")
    }

    this._calculated_threshold = null
  }

  /**
   * Gets path tag for SVG output
   * @param {string} [fillColor] - Override fill color
   * @returns {string} SVG path tag
   * @throws {Error} If image not loaded
   */
  get_path_tag(fillColor) {
    fillColor = arguments.length === 0 ? this._params.color : fillColor

    if (fillColor === Potrace.COLOR_AUTO) {
      fillColor = this._params.blackOnWhite ? 'black' : 'white'
    }

    if (!this._image_loaded) {
      throw new Error('Image should be loaded first')
    }

    if (!this._processed) {
      this._bm_to_pathlist()
      this._process_path()
      this._processed = true
    }

    var tag = '<path itemprop="path" d="'

    this._pathlist.forEach(function (path) {
      tag += utils.renderCurve(path.curve, 1)
    })

    tag += '" style="fill-rule:evenodd"/>'

    return tag
  }

  /**
   * Gets path data for SVG output
   * @param {string} [fillColor] - Override fill color
   * @returns {string} SVG path data
   * @throws {Error} If image not loaded
   */
  get_path_data(fillColor) {
    fillColor = arguments.length === 0 ? this._params.color : fillColor

    if (fillColor === Potrace.COLOR_AUTO) {
      fillColor = this._params.blackOnWhite ? 'black' : 'white'
    }

    if (!this._image_loaded) {
      throw new Error('Image should be loaded first')
    }

    if (!this._processed) {
      this._bm_to_pathlist()
      this._process_path()
      this._processed = true
    }

    var tag = ''

    this._pathlist.forEach(function (path) {
      tag += utils.renderCurve(path.curve, 1)
    })

    return tag
  }

  /**
   * Fine tunes color ranges by adding extra color stops for better shadow and line art representation
   * @private
   * @param {Array<Object>} ranges - Current color ranges
   * @returns {Array<Object>} Modified color ranges
   */
  _add_extra_color_stop(ranges) {
    var blackOnWhite = this._params.blackOnWhite
    var lastColorStop = ranges[ranges.length - 1]
    var lastRangeFrom = blackOnWhite ? 0 : lastColorStop.value
    var lastRangeTo = blackOnWhite ? lastColorStop.value : 255

    if (
      lastRangeTo - lastRangeFrom > 25 &&
      lastColorStop.colorIntensity !== 1
    ) {
      var histogram = this._get_image_histogram()
      var levels = histogram.getStats(lastRangeFrom, lastRangeTo).levels

      var newColorStop =
        levels.mean + levels.stdDev <= 25
          ? levels.mean + levels.stdDev
          : levels.mean - levels.stdDev <= 25
            ? levels.mean - levels.stdDev
            : 25

      var newStats = blackOnWhite
        ? histogram.getStats(0, newColorStop)
        : histogram.getStats(newColorStop, 255)
      var color = newStats.levels.mean

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
   * Calculates color intensity for each element of numeric array
   * @private
   * @param {number[]} colorStops - Array of threshold values
   * @returns {Array<{value: number, colorIntensity: number}>} Color stops with calculated intensities
   */
  _calc_color_intensity(colorStops) {
    var blackOnWhite = this._params.blackOnWhite
    var colorSelectionStrat = this._params.fillStrategy
    var histogram =
      colorSelectionStrat !== Potrace.FILL_SPREAD
        ? this._get_image_histogram()
        : null
    var fullRange = Math.abs(this._param_threshold() - (blackOnWhite ? 0 : 255))

    return colorStops.map(function (threshold, index) {
      var nextValue =
        index + 1 === colorStops.length
          ? blackOnWhite
            ? -1
            : 256
          : colorStops[index + 1]
      var rangeStart = Math.round(blackOnWhite ? nextValue + 1 : threshold)
      var rangeEnd = Math.round(blackOnWhite ? threshold : nextValue - 1)
      var factor = index / (colorStops.length - 1)
      var intervalSize = rangeEnd - rangeStart
      var stats = histogram.getStats(rangeStart, rangeEnd)
      var color = -1

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
          color = histogram.getDominantColor(
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
   * Gets image histogram for color analysis
   * @private
   * @returns {Histogram} Image histogram
   */
  _get_image_histogram() {
    return this._luminance_data.histogram()
  }

  /**
   * Gets ranges for posterization
   * @private
   * @returns {Array<Object>} Color ranges
   */
  _get_ranges() {
    var steps = this._param_steps()

    if (!Array.isArray(steps)) {
      return this._params.rangeDistribution === Potrace.RANGES_AUTO
        ? this._get_ranges_auto()
        : this._get_ranges_equally_distributed()
    }

    // Steps is array of thresholds and we want to preprocess it

    var colorStops = []
    var threshold = this._param_threshold()
    var lookingForDarkPixels = this._params.blackOnWhite

    steps.forEach(function (item) {
      if (colorStops.indexOf(item) === -1 && utils.between(item, 0, 255)) {
        colorStops.push(item)
      }
    })

    if (!colorStops.length) {
      colorStops.push(threshold)
    }

    colorStops = colorStops.sort(function (a, b) {
      return a < b === lookingForDarkPixels ? 1 : -1
    })

    if (lookingForDarkPixels && colorStops[0] < threshold) {
      colorStops.unshift(threshold)
    } else if (
      !lookingForDarkPixels &&
      colorStops[colorStops.length - 1] < threshold
    ) {
      colorStops.push(threshold)
    }

    return this._calc_color_intensity(colorStops)
  }

  /**
   * Gets auto-calculated ranges
   * @private
   * @returns {Array<Object>} Auto-calculated ranges
   */
  _get_ranges_auto() {
    var histogram = this._get_image_histogram()
    var steps = this._param_steps(true)
    var colorStops

    if (this._params.threshold === Potrace.THRESHOLD_AUTO) {
      colorStops = histogram.multilevelThresholding(steps)
    } else {
      var threshold = this._param_threshold()

      colorStops = this._params.blackOnWhite
        ? histogram.multilevelThresholding(steps - 1, 0, threshold)
        : histogram.multilevelThresholding(steps - 1, threshold, 255)

      if (this._params.blackOnWhite) {
        colorStops.push(threshold)
      } else {
        colorStops.unshift(threshold)
      }
    }

    if (this._params.blackOnWhite) {
      colorStops = colorStops.reverse()
    }

    return this._calc_color_intensity(colorStops)
  }

  /**
   * Gets equally distributed ranges
   * @private
   * @returns {Array<Object>} Equally distributed ranges
   */
  _get_ranges_equally_distributed() {
    var blackOnWhite = this._params.blackOnWhite
    var colorsToThreshold = blackOnWhite
      ? this._param_threshold()
      : 255 - this._param_threshold()
    var steps = this._param_steps()

    var stepSize = colorsToThreshold / steps
    var colorStops = []
    var i = steps - 1,
      factor,
      threshold

    while (i >= 0) {
      factor = i / (steps - 1)
      threshold = Math.min(colorsToThreshold, (i + 1) * stepSize)
      threshold = blackOnWhite ? threshold : 255 - threshold
      i--

      colorStops.push(threshold)
    }

    return this._calc_color_intensity(colorStops)
  }

  /**
   * Gets valid steps parameter
   * @private
   * @param {boolean} [count=false] - Return count instead of steps
   * @returns {number|Array} Steps value or count
   */
  _param_steps(count) {
    var steps = this._params.steps

    if (Array.isArray(steps)) {
      return count ? steps.length : steps
    }

    if (
      steps === Potrace.STEPS_AUTO &&
      this._params.threshold === Potrace.THRESHOLD_AUTO
    ) {
      return 4
    }

    var blackOnWhite = this._params.blackOnWhite
    var colorsCount = blackOnWhite
      ? this._param_threshold()
      : 255 - this._param_threshold()

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
  _param_threshold() {
    if (this._calculated_threshold !== null) {
      return this._calculated_threshold
    }

    if (this._params.threshold !== Potrace.THRESHOLD_AUTO) {
      this._calculated_threshold = this._params.threshold
      return this._calculated_threshold
    }

    var twoThresholds = this._get_image_histogram().multilevelThresholding(2)
    this._calculated_threshold = this._params.blackOnWhite
      ? twoThresholds[1]
      : twoThresholds[0]
    this._calculated_threshold = this._calculated_threshold || 128

    return this._calculated_threshold
  }

  /**
   * Gets path tags for all thresholds
   * @private
   * @param {boolean} [noFillColor] - Skip fill color
   * @returns {Array<string>} Array of path tags
   */
  _path_tags(noFillColor) {
    const ranges = this._get_ranges()
    const set_parameters = this.set_parameters.bind(this)
    const blackOnWhite = this._params.blackOnWhite

    if (ranges.length >= 10) {
      ranges = this._add_extra_color_stop(ranges)
    }

    set_parameters({ blackOnWhite: blackOnWhite })

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

      set_parameters({ threshold: colorStop.value })

      var element = noFillColor ? this.get_path_tag('') : this.get_path_tag()
      element = utils.setHtmlAttr(
        element,
        'fill-opacity',
        calculatedOpacity.toFixed(3)
      )

      var canBeIgnored =
        calculatedOpacity === 0 || element.indexOf(' d=""') !== -1

      var c = Math.round(
        Math.abs((blackOnWhite ? 255 : 0) - 255 * thisLayerOpacity)
      )
      element = utils.setHtmlAttr(
        element,
        'fill',
        'rgb(' + c + ', ' + c + ', ' + c + ')'
      )

      return canBeIgnored ? '' : element
    })
  }

  /**
   * Converts the loaded image into an array of curve paths
   * @returns {Array<{d: string, fillOpacity: string}>} Array of path objects with SVG path data and opacity
   */
  as_curves() {
    const ranges = this._get_ranges()
    const set_parameters = this.set_parameters.bind(this)
    const blackOnWhite = this._params.blackOnWhite

    set_parameters({ blackOnWhite: blackOnWhite })

    let actualPrevLayersOpacity = 0

    return ranges.map(colorStop => {
      const thisLayerOpacity = colorStop.colorIntensity

      if (thisLayerOpacity === 0) return ''

      var calculatedOpacity =
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

      set_parameters({ threshold: colorStop.value })

      return {
        d: this.get_path_data(),
        fillOpacity: calculatedOpacity.toFixed(3)
      }
    })
  }
}

export default {
  as_paths,
  Potrace
}
