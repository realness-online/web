/**
 * Potrace bitmap-to-vector tracing algorithm
 * Port of the C Potrace algorithm
 */
import Curve from '@/potrace/types/Curve'
import Point from '@/potrace/types/Point'
import Quad from '@/potrace/types/Quad'
import Sum from '@/potrace/types/Sum'
import Opti from '@/potrace/types/Opti'
import utils from '@/potrace/utils'
import Histogram from '@/potrace/types/Histogram'
import Path from '@/potrace/types/Path'
import Bitmap from '@/potrace/types/Bitmap'
import {
  image_data_to_luminance,
  calculate_threshold,
  apply_threshold
} from '@/potrace/bitmap-processor'
import { trace_all_paths } from '@/potrace/tracer'

// Potrace algorithm constants with explanations

// RGB color space
const RGB_MAX = 255
const RGBA_COMPONENTS = 4

// Geometric calculations
const HALF = 0.5

// Tangent angle threshold for detecting near-parallel lines
// cos(angle) ≈ -1 means angle ≈ 180° (parallel but opposite direction)
const TANGENT_PARALLEL_THRESHOLD = -0.999847695156

// Corner detection parameters
const ALPHA_SCALE_FACTOR = 0.75 // Default alpha scaling for corner detection
const MIN_ALPHA_THRESHOLD = 0.55 // Minimum threshold for corner detection

// Curve optimization parameters
const CURVATURE_THRESHOLD = -0.5 // Threshold for determining curve direction
const CURVATURE_SCALE = 0.75 // Scaling factor for curvature calculations
const PENALTY_RATIO = 0.3 // Penalty weight for curve optimization

// Posterization thresholds
const POSTERIZE_BRIGHTNESS_THRESHOLD = 200
const POSTERIZE_STEP_SCALE = 0.1

// Other thresholds
const ALPHA_TRANSPARENCY_THRESHOLD = 128
const LARGE_NUMBER = 10000000 // Used for infinity approximation
const POSTERIZE_LEVEL_STEP = 25
const COLOR_SPACE_SIZE = 256
const MIN_RANGE_COUNT = 10

/** @typedef {'spread' | 'dominant' | 'median' | 'mean'} FillStrategy */

/**
 * @typedef {Object} PotraceOptions
 * @property {'black'|'white'|'left'|'right'|'minority'|'majority'} [turnPolicy='minority'] - How to resolve ambiguities in path decomposition.
 *    - 'black': Always choose the black pixel in ambiguous cases
 *    - 'white': Always choose the white pixel in ambiguous cases
 *    - 'left': Always choose the leftmost pixel in ambiguous cases
 *    - 'right': Always choose the rightmost pixel in ambiguous cases
 *    - 'minority': Choose the color that occurs least frequently in the local neighborhood
 *    - 'majority': Choose the color that occurs most frequently in the local neighborhood
 * @property {number} [turdSize=2] - Suppress speckles of up to this size (must be >= 0)
 * @property {number} [alphaMax=1] - Corner threshold parameter. Higher values detect more corners (must be >= 0)
 * @property {boolean} [optCurve=true] - Whether to optimize the path curves for smoother rendering
 * @property {number} [optTolerance=0.2] - Curve optimization tolerance. Higher values create simpler paths (must be >= 0)
 * @property {number|'auto'} [threshold='auto'] - Color threshold for black/white separation (0-255 or 'auto')
 * @property {boolean} [blackOnWhite=true] - If true, traces dark areas. If false, traces light areas
 * @property {string} [color='auto'] - Foreground color ('auto', 'black', 'white', or any valid CSS color)
 * @property {string} [background='transparent'] - Background color (any valid CSS color)
 * @property {number|number[]|'auto'} [steps='auto'] - Number of posterization steps or array of threshold values
 * @property {FillStrategy} [fillStrategy='dominant'] - How to determine colors in posterization:
 *    - 'spread': Distribute colors evenly
 *    - 'dominant': Use most frequent colors
 *    - 'median': Use median color value
 *    - 'mean': Use average color value
 * @property {'auto'|'equal'} [rangeDistribution='auto'] - How to distribute posterization ranges:
 *    - 'auto': Automatically determine optimal ranges
 *    - 'equal': Use equal-sized ranges
 */

/**
 * Represents a single SVG path with its rendering properties
 * @typedef {Object} PathData
 * @property {string} d - SVG path data string using moveto, lineto, curveto commands
 * @property {string} fillOpacity - Fill opacity value between 0 and 1
 */

/**
 * Result of processing an image into SVG paths
 * @typedef {Object} ProcessedPaths
 * @property {number} width - Original image width in pixels
 * @property {number} height - Original image height in pixels
 * @property {boolean} dark - Whether the image is dark on light background
 * @property {Array<PathData>} paths - Array of SVG path data objects
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
  static FILL_SPREAD = /** @type {FillStrategy} */ ('spread')
  static FILL_DOMINANT = /** @type {FillStrategy} */ ('dominant')
  static FILL_MEDIAN = /** @type {FillStrategy} */ ('median')
  static FILL_MEAN = /** @type {FillStrategy} */ ('mean')

  /** @type {'auto'} */
  static RANGES_AUTO = 'auto'

  /** @type {'equal'} */
  static RANGES_EQUAL = 'equal'

  /** @typedef {'black' | 'white' | 'left' | 'right' | 'minority' | 'majority'} TurnPolicy */

  /** @type {Record<string, TurnPolicy>} */
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

  /** @type {Bitmap|null} */
  #luminance_data = null

  /** @type {Path[]} */
  #pathlist = []

  /** @type {boolean} */
  #image_loaded = false

  /** @type {boolean} */
  #processed = false

  /** @type {number|null} */
  #calculated_threshold = null

  /**
   * @type {Required<PotraceOptions>}
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
   * Converts bitmap data to vector paths
   * @returns {void}
   * @throws {Error} If image is not loaded
   * @description
   * Core vectorization process:
   * 1. Applies threshold to create binary image
   * 2. Finds and traces all paths in the image
   * 3. Filters paths based on turdSize
   * 4. Stores resulting paths in pathlist
   */
  #bitmap_to_pathlist() {
    const threshold = calculate_threshold(
      this.#luminance_data,
      this.#params.threshold
    )
    const black_map = apply_threshold(
      this.#luminance_data,
      threshold,
      this.#params.blackOnWhite
    )

    this.#pathlist = trace_all_paths(
      black_map,
      this.#params.turnPolicy,
      this.#params.turdSize
    )
  }

  /**
   * Calculates sums for path optimization
   * @param {Path} path - Path to calculate sums for
   * @returns {void}
   * @description
   * Computes running sums of:
   * - x and y coordinates
   * - x*y products
   * - x² and y² values
   * These sums are used later for curve fitting and optimization to minimize
   * the squared distance between the curve and the original path points.
   */
  #calc_sums = path => {
    let i
    let relative_x
    let relative_y
    path.x0 = path.points[0].x
    path.y0 = path.points[0].y

    path.sums = []
    const running_sums = path.sums
    running_sums.push(new Sum(0, 0, 0, 0, 0))
    for (i = 0; i < path.len; i++) {
      relative_x = path.points[i].x - path.x0
      relative_y = path.points[i].y - path.y0
      running_sums.push(
        new Sum(
          running_sums[i].x + relative_x,
          running_sums[i].y + relative_y,
          running_sums[i].xy + relative_x * relative_y,
          running_sums[i].x2 + relative_x * relative_x,
          running_sums[i].y2 + relative_y * relative_y
        )
      )
    }
  }

  /**
   * Initializes next candidate vertices for path optimization
   * Finds the next vertex that differs from current in position
   * @param {Path} path - Path to process
   * @returns {number[]} Array of next candidate indices
   */
  #initialize_next_candidates(path) {
    const n = path.len
    const { points } = path
    const next_candidates = []
    let k = 0

    for (let i = n - 1; i >= 0; i--) {
      if (points[i].x !== points[k].x && points[i].y !== points[k].y) k = i + 1

      next_candidates[i] = k
    }

    return next_candidates
  }

  /**
   * Calculates longest sequences for path optimization
   * @param {Path} path - Path to calculate sequences for
   * @returns {void}
   */
  #calc_lon = path => {
    const next_candidates = this.#initialize_next_candidates(path)
    const pivot_vertices = this.#find_pivot_vertices(path, next_candidates)
    this.#compute_longest_sequences(path, pivot_vertices)
  }

  /**
   * Finds pivot vertices for polygon optimization
   * @param {Path} path - Path to process
   * @param {number[]} next_candidates - Array of next candidate indices
   * @returns {number[]} Array of pivot vertex indices
   */
  #find_pivot_vertices(path, next_candidates) {
    const n = path.len
    const { points } = path
    const pivot_vertices = []
    const direction_counts = []
    const constraint = [new Point(), new Point()]
    const current_point = new Point()
    const offset_point = new Point()
    const direction_delta = new Point()

    let i
    let j
    let dir
    let prev_vertex
    let found_pivot
    let constraint0_cross_cur
    let constraint0_cross_dk
    let constraint1_cross_cur
    let constraint1_cross_dk
    let k

    for (i = n - 1; i >= 0; i--) {
      direction_counts[0] =
        direction_counts[1] =
        direction_counts[2] =
        direction_counts[3] =
          0
      dir =
        (3 +
          3 * (points[utils.mod(i + 1, n)].x - points[i].x) +
          (points[utils.mod(i + 1, n)].y - points[i].y)) /
        2
      direction_counts[dir]++

      constraint[0].x = 0
      constraint[0].y = 0
      constraint[1].x = 0
      constraint[1].y = 0

      k = next_candidates[i]
      prev_vertex = i
      while (true) {
        found_pivot = 0
        dir =
          (3 +
            3 * utils.sign(points[k].x - points[prev_vertex].x) +
            utils.sign(points[k].y - points[prev_vertex].y)) /
          2
        direction_counts[dir]++

        if (
          direction_counts[0] &&
          direction_counts[1] &&
          direction_counts[2] &&
          direction_counts[3]
        ) {
          pivot_vertices[i] = prev_vertex
          found_pivot = 1
          break
        }

        current_point.x = points[k].x - points[i].x
        current_point.y = points[k].y - points[i].y

        if (
          utils.xprod(constraint[0], current_point) < 0 ||
          utils.xprod(constraint[1], current_point) > 0
        )
          break

        // Skip if point is within unit square
        if (Math.abs(current_point.x) > 1 || Math.abs(current_point.y) > 1) {
          offset_point.x =
            current_point.x +
            (current_point.y >= 0 &&
            (current_point.y > 0 || current_point.x < 0)
              ? 1
              : -1)
          offset_point.y =
            current_point.y +
            (current_point.x <= 0 &&
            (current_point.x < 0 || current_point.y < 0)
              ? 1
              : -1)
          if (utils.xprod(constraint[0], offset_point) >= 0) {
            constraint[0].x = offset_point.x
            constraint[0].y = offset_point.y
          }
          offset_point.x =
            current_point.x +
            (current_point.y <= 0 &&
            (current_point.y < 0 || current_point.x < 0)
              ? 1
              : -1)
          offset_point.y =
            current_point.y +
            (current_point.x >= 0 &&
            (current_point.x > 0 || current_point.y < 0)
              ? 1
              : -1)
          if (utils.xprod(constraint[1], offset_point) <= 0) {
            constraint[1].x = offset_point.x
            constraint[1].y = offset_point.y
          }
        }
        prev_vertex = k
        k = next_candidates[prev_vertex]
        if (!utils.cyclic(k, i, prev_vertex)) break
      }
      if (found_pivot === 0) {
        direction_delta.x = utils.sign(points[k].x - points[prev_vertex].x)
        direction_delta.y = utils.sign(points[k].y - points[prev_vertex].y)
        current_point.x = points[prev_vertex].x - points[i].x
        current_point.y = points[prev_vertex].y - points[i].y

        constraint0_cross_cur = utils.xprod(constraint[0], current_point)
        constraint0_cross_dk = utils.xprod(constraint[0], direction_delta)
        constraint1_cross_cur = utils.xprod(constraint[1], current_point)
        constraint1_cross_dk = utils.xprod(constraint[1], direction_delta)

        j = LARGE_NUMBER

        if (constraint0_cross_dk < 0)
          j = Math.floor(constraint0_cross_cur / -constraint0_cross_dk)

        if (constraint1_cross_dk > 0)
          j = Math.min(
            j,
            Math.floor(-constraint1_cross_cur / constraint1_cross_dk)
          )

        pivot_vertices[i] = utils.mod(prev_vertex + j, n)
      }
    }

    return pivot_vertices
  }

  /**
   * Computes longest straight sequences from pivot vertices
   * @param {Path} path - Path to update
   * @param {number[]} pivot_vertices - Array of pivot vertex indices
   * @returns {void}
   */
  #compute_longest_sequences(path, pivot_vertices) {
    const n = path.len
    path.longest_straight_seq = []

    let j = pivot_vertices[n - 1]
    path.longest_straight_seq[n - 1] = j

    for (let i = n - 2; i >= 0; i--) {
      if (utils.cyclic(i + 1, pivot_vertices[i], j)) j = pivot_vertices[i]

      path.longest_straight_seq[i] = j
    }

    for (
      let i = n - 1;
      utils.cyclic(utils.mod(i + 1, n), j, path.longest_straight_seq[i]);
      i--
    )
      path.longest_straight_seq[i] = j
  }

  /**
   * Determines optimal polygon for path
   * @param {Path} path - Path to optimize
   * @returns {void}
   * @description
   * This method finds the optimal polygon approximation of the path using the following steps:
   * 1. Calculates penalty values for all possible vertex combinations
   * 2. Uses dynamic programming to find the sequence of vertices that minimizes total penalty
   * 3. Stores the optimal vertex sequence in the path object
   * The penalty calculation considers both the deviation from the original path and the
   * number of vertices used.
   */
  #best_polygon = path => {
    const penalty3 = (path, i, j) => {
      const n = path.len
      const { points } = path
      const { sums } = path
      let sum_x
      let sum_y
      let sum_xy
      let sum_x2
      let sum_y2
      let segment_length
      let wrap_count = 0
      let j_norm = j
      if (j_norm >= n) {
        j_norm -= n
        wrap_count = 1
      }

      if (wrap_count === 0) {
        sum_x = sums[j + 1].x - sums[i].x
        sum_y = sums[j + 1].y - sums[i].y
        sum_x2 = sums[j + 1].x2 - sums[i].x2
        sum_xy = sums[j + 1].xy - sums[i].xy
        sum_y2 = sums[j + 1].y2 - sums[i].y2
        segment_length = j + 1 - i
      } else {
        sum_x = sums[j + 1].x - sums[i].x + sums[n].x
        sum_y = sums[j + 1].y - sums[i].y + sums[n].y
        sum_x2 = sums[j + 1].x2 - sums[i].x2 + sums[n].x2
        sum_xy = sums[j + 1].xy - sums[i].xy + sums[n].xy
        sum_y2 = sums[j + 1].y2 - sums[i].y2 + sums[n].y2
        segment_length = j + 1 - i + n
      }

      const px = (points[i].x + points[j].x) / 2.0 - points[0].x
      const py = (points[i].y + points[j].y) / 2.0 - points[0].y
      const ey = points[j].x - points[i].x
      const ex = -(points[j].y - points[i].y)

      const var_xx = (sum_x2 - 2 * sum_x * px) / segment_length + px * px
      const var_xy =
        (sum_xy - sum_x * py - sum_y * px) / segment_length + px * py
      const var_yy = (sum_y2 - 2 * sum_y * py) / segment_length + py * py

      const weighted_sum =
        ex * ex * var_xx + 2 * ex * ey * var_xy + ey * ey * var_yy

      return Math.sqrt(weighted_sum)
    }

    let i
    let j
    let k
    const n = path.len
    const pen = []
    const prev = []
    const clip0 = []
    const clip1 = []
    const seg0 = []
    const seg1 = []
    let current_penalty
    let best_penalty
    let clip_value

    for (i = 0; i < n; i++) {
      clip_value = utils.mod(
        path.longest_straight_seq[utils.mod(i - 1, n)] - 1,
        n
      )
      if (clip_value === i) clip_value = utils.mod(i + 1, n)

      if (clip_value < i) clip0[i] = n
      else clip0[i] = clip_value
    }

    j = 1
    for (i = 0; i < n; i++)
      while (j <= clip0[i]) {
        clip1[j] = i
        j++
      }

    i = 0
    for (j = 0; i < n; j++) {
      seg0[j] = i
      i = clip0[i]
    }
    seg0[j] = n
    const m = j

    i = n
    for (j = m; j > 0; j--) {
      seg1[j] = i
      i = clip1[i]
    }
    seg1[0] = 0

    pen[0] = 0
    for (j = 1; j <= m; j++)
      for (i = seg1[j]; i <= seg0[j]; i++) {
        best_penalty = -1
        for (k = seg0[j - 1]; k >= clip1[i]; k--) {
          current_penalty = penalty3(path, k, i) + pen[k]
          if (best_penalty < 0 || current_penalty < best_penalty) {
            prev[i] = k
            best_penalty = current_penalty
          }
        }
        pen[i] = best_penalty
      }

    path.m = m
    path.optimal_vertices = []

    for (i = n, j = m - 1; i > 0; j--) {
      i = prev[i]
      path.optimal_vertices[j] = i
    }
  }

  /**
   * Calculates point slope and direction for a path segment
   * @param {Path} path - Path containing the segment
   * @param {number} i - Start index
   * @param {number} j - End index
   * @param {Point} ctr - Center point output
   * @param {Point} dir - Direction output
   */
  #calc_point_slope(path, i, j, ctr, dir) {
    const n = path.len
    const { sums } = path
    let cov_xx
    let cov_yy
    let length
    let wrap_count = 0
    let j_norm = j
    let i_norm = i

    // Normalize indices to path length
    while (j_norm >= n) {
      j_norm -= n
      wrap_count += 1
    }
    while (i_norm >= n) {
      i_norm -= n
      wrap_count -= 1
    }
    while (j_norm < 0) {
      j_norm += n
      wrap_count -= 1
    }
    while (i_norm < 0) {
      i_norm += n
      wrap_count += 1
    }

    // Calculate sums for the segment
    const x = sums[j_norm + 1].x - sums[i_norm].x + wrap_count * sums[n].x
    const y = sums[j_norm + 1].y - sums[i_norm].y + wrap_count * sums[n].y
    const x2 = sums[j_norm + 1].x2 - sums[i_norm].x2 + wrap_count * sums[n].x2
    const xy = sums[j_norm + 1].xy - sums[i_norm].xy + wrap_count * sums[n].xy
    const y2 = sums[j_norm + 1].y2 - sums[i_norm].y2 + wrap_count * sums[n].y2
    const segment_length = j_norm + 1 - i_norm + wrap_count * n

    // Calculate center point
    ctr.x = x / segment_length
    ctr.y = y / segment_length

    // Calculate covariance matrix
    cov_xx = (x2 - (x * x) / segment_length) / segment_length
    const cov_xy = (xy - (x * y) / segment_length) / segment_length
    cov_yy = (y2 - (y * y) / segment_length) / segment_length

    // Calculate eigenvalue
    const lambda2 =
      (cov_xx +
        cov_yy +
        Math.sqrt(
          (cov_xx - cov_yy) * (cov_xx - cov_yy) +
            RGBA_COMPONENTS * cov_xy * cov_xy
        )) /
      2

    cov_xx -= lambda2
    cov_yy -= lambda2

    // Calculate direction from eigenvector
    if (Math.abs(cov_xx) >= Math.abs(cov_yy)) {
      length = Math.sqrt(cov_xx * cov_xx + cov_xy * cov_xy)
      if (length !== 0) {
        dir.x = -cov_xy / length
        dir.y = cov_xx / length
      }
    } else {
      length = Math.sqrt(cov_yy * cov_yy + cov_xy * cov_xy)
      if (length !== 0) {
        dir.x = -cov_yy / length
        dir.y = cov_xy / length
      }
    }
    if (length === 0) dir.x = dir.y = 0
  }

  /**
   * Builds quadratic forms for path segments
   * @param {number} m - Number of segments
   * @param {Point[]} ctr - Center points
   * @param {Point[]} dir - Direction vectors
   * @returns {Quad[]} Array of quadratic forms
   */
  #build_quadratic_forms(m, ctr, dir) {
    const q = []
    const normal_form = []

    for (let i = 0; i < m; i++) {
      q[i] = new Quad()
      const dir_length_squared = dir[i].x * dir[i].x + dir[i].y * dir[i].y

      if (dir_length_squared === 0.0)
        for (let j = 0; j < 3; j++)
          for (let k = 0; k < 3; k++) q[i].data[j * 3 + k] = 0
      else {
        normal_form[0] = dir[i].y
        normal_form[1] = -dir[i].x
        normal_form[2] = -normal_form[1] * ctr[i].y - normal_form[0] * ctr[i].x
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++)
            q[i].data[row * 3 + col] =
              (normal_form[row] * normal_form[col]) / dir_length_squared
      }
    }

    return q
  }

  /**
   * Optimizes a single vertex position
   * @param {Quad} Q - Combined quadratic form
   * @param {Point} s - Original vertex position
   * @returns {Point} Optimized position
   */
  #optimize_vertex(Q, s) {
    const candidate = new Point()

    // Try to solve for optimal position
    const det = Q.at(0, 0) * Q.at(1, 1) - Q.at(0, 1) * Q.at(1, 0)
    if (det !== 0.0) {
      candidate.x = (-Q.at(0, 2) * Q.at(1, 1) + Q.at(1, 2) * Q.at(0, 1)) / det
      candidate.y = (Q.at(0, 2) * Q.at(1, 0) - Q.at(1, 2) * Q.at(0, 0)) / det

      const dx = Math.abs(candidate.x - s.x)
      const dy = Math.abs(candidate.y - s.y)
      if (dx <= HALF && dy <= HALF) return candidate
    }

    // Find minimum by trying candidate positions
    let min_error = utils.quadform(Q, s)
    let best_x = s.x
    let best_y = s.y

    // Try positions along horizontal constraints
    if (Q.at(0, 0) !== 0.0)
      for (let offset = 0; offset < 2; offset++) {
        candidate.y = s.y - HALF + offset
        candidate.x = -(Q.at(0, 1) * candidate.y + Q.at(0, 2)) / Q.at(0, 0)
        const dx = Math.abs(candidate.x - s.x)
        const error = utils.quadform(Q, candidate)
        if (dx <= HALF && error < min_error) {
          min_error = error
          best_x = candidate.x
          best_y = candidate.y
        }
      }

    // Try positions along vertical constraints
    if (Q.at(1, 1) !== 0.0)
      for (let offset = 0; offset < 2; offset++) {
        candidate.x = s.x - HALF + offset
        candidate.y = -(Q.at(1, 0) * candidate.x + Q.at(1, 2)) / Q.at(1, 1)
        const dy = Math.abs(candidate.y - s.y)
        const error = utils.quadform(Q, candidate)
        if (dy <= HALF && error < min_error) {
          min_error = error
          best_x = candidate.x
          best_y = candidate.y
        }
      }

    // Try corner positions
    for (let x_offset = 0; x_offset < 2; x_offset++)
      for (let y_offset = 0; y_offset < 2; y_offset++) {
        candidate.x = s.x - HALF + x_offset
        candidate.y = s.y - HALF + y_offset
        const error = utils.quadform(Q, candidate)
        if (error < min_error) {
          min_error = error
          best_x = candidate.x
          best_y = candidate.y
        }
      }

    return new Point(best_x, best_y)
  }

  /**
   * Adjusts vertices of the path
   * @param {Path} path - Path to adjust
   * @returns {void}
   * @description
   * Adjusts vertices of the path by:
   * 1. Calculating the slope and center point for each segment
   * 2. Determining the direction and curvature of the path
   * 3. Optimizing the path for smoother curves
   */
  #adjust_vertices = path => {
    const { m } = path
    const { optimal_vertices } = path
    const n = path.len
    const { points } = path
    const { x0 } = path
    const { y0 } = path
    const ctr = []
    const dir = []
    const regularization_vector = []

    path.curve = new Curve(m)

    // Phase 1: Calculate slope and direction for each segment
    for (let i = 0; i < m; i++) {
      let j = utils.mod(i + 1, m)
      j = utils.mod(j - optimal_vertices[i], n) + optimal_vertices[i]
      ctr[i] = new Point()
      dir[i] = new Point()
      this.#calc_point_slope(path, optimal_vertices[i], j, ctr[i], dir[i])
    }

    // Phase 2: Build quadratic forms
    const q = this.#build_quadratic_forms(m, ctr, dir)

    // Phase 3: Optimize each vertex position
    for (let i = 0; i < m; i++) {
      const Q = new Quad()
      const original_vertex = new Point(
        points[optimal_vertices[i]].x - x0,
        points[optimal_vertices[i]].y - y0
      )
      const prev_i = utils.mod(i - 1, m)

      // Combine adjacent quadratic forms
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++)
          Q.data[row * 3 + col] = q[prev_i].at(row, col) + q[i].at(row, col)

      // Handle singular matrix by adding regularization
      while (true) {
        const det = Q.at(0, 0) * Q.at(1, 1) - Q.at(0, 1) * Q.at(1, 0)
        if (det !== 0.0) break

        // Add regularization term
        if (Q.at(0, 0) > Q.at(1, 1)) {
          regularization_vector[0] = -Q.at(0, 1)
          regularization_vector[1] = Q.at(0, 0)
        } else if (Q.at(1, 1)) {
          regularization_vector[0] = -Q.at(1, 1)
          regularization_vector[1] = Q.at(1, 0)
        }
        const vector_length_squared =
          regularization_vector[0] * regularization_vector[0] +
          regularization_vector[1] * regularization_vector[1]
        regularization_vector[2] =
          -regularization_vector[1] * original_vertex.y -
          regularization_vector[0] * original_vertex.x
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++)
            Q.data[row * 3 + col] +=
              (regularization_vector[row] * regularization_vector[col]) /
              vector_length_squared
      }

      // Find optimal vertex position
      const optimized = this.#optimize_vertex(Q, original_vertex)
      path.curve.vertex[i] = new Point(optimized.x + x0, optimized.y + y0)
    }
  }

  /**
   * Reverses path direction
   * @param {Path} path - Path to reverse
   * @returns {void}
   * @description
   * Reverses the direction of the path by swapping its vertices
   */
  #reverse = path => {
    const { curve } = path
    const m = curve.n
    const vertices = curve.vertex
    let start
    let end
    let temp

    for (start = 0, end = m - 1; start < end; start++, end--) {
      temp = vertices[start]
      vertices[start] = vertices[end]
      vertices[end] = temp
    }
  }

  /**
   * Smooths path curves
   * @param {Path} path - Path to smooth
   * @returns {void}
   * @description
   * Smooths the path curves by:
   * 1. Calculating the alpha value for each curve segment
   * 2. Determining the curve type (corner or curve)
   * 3. Calculating control points for smooth curves
   */
  #smooth = path => {
    const m = path.curve.n
    const { curve } = path

    let i
    let j
    let k
    let parallel_distance
    let denom
    let alpha
    let control_point_0
    let control_point_1
    let control_point_2

    for (i = 0; i < m; i++) {
      j = utils.mod(i + 1, m)
      k = utils.mod(i + 2, m)
      control_point_2 = utils.interval(
        1 / 2.0,
        curve.vertex[k],
        curve.vertex[j]
      )

      denom = utils.ddenom(curve.vertex[i], curve.vertex[k])
      if (denom !== 0.0) {
        parallel_distance =
          utils.dpara(curve.vertex[i], curve.vertex[j], curve.vertex[k]) / denom
        parallel_distance = Math.abs(parallel_distance)
        alpha = parallel_distance > 1 ? 1 - 1.0 / parallel_distance : 0
        alpha = alpha / ALPHA_SCALE_FACTOR
      } else alpha = RGBA_COMPONENTS / 3.0

      curve.alpha0[j] = alpha

      if (alpha >= this.#params.alphaMax) {
        curve.tag[j] = 'CORNER'
        curve.c[3 * j + 1] = curve.vertex[j]
        curve.c[3 * j + 2] = control_point_2
      } else {
        if (alpha < MIN_ALPHA_THRESHOLD) alpha = MIN_ALPHA_THRESHOLD
        else if (alpha > 1) alpha = 1

        control_point_0 = utils.interval(
          HALF + HALF * alpha,
          curve.vertex[i],
          curve.vertex[j]
        )
        control_point_1 = utils.interval(
          HALF + HALF * alpha,
          curve.vertex[k],
          curve.vertex[j]
        )
        curve.tag[j] = 'CURVE'
        curve.c[3 * j + 0] = control_point_0
        curve.c[3 * j + 1] = control_point_1
        curve.c[3 * j + 2] = control_point_2
      }
      curve.alpha[j] = alpha
      curve.beta[j] = HALF
    }
    curve.alpha_curve = 1
  }

  /**
   * Optimizes path curves
   * @param {Path} path - Path to optimize
   * @returns {void}
   * @throws {Error} If path is invalid
   * @description
   * Optimizes the path curves by:
   * 1. Calculating the optimal curve for each segment
   * 2. Determining the best curve sequence
   * 3. Reconstructing the optimized curve
   */
  #opti_curve = path => {
    const { curve } = path
    const m = curve.n
    const vert = curve.vertex
    const previous = []
    const pen = []
    const len = []
    const opt = []
    let optimized_segment_count
    let i
    let j
    let should_reject
    let current_optimization = new Opti()
    let p0
    let next_i
    let area
    let alpha
    let optimized_curve
    const s_params = []
    const t_params = []

    const convexity_array = []
    const cumulative_area = []

    for (i = 0; i < m; i++)
      if (curve.tag[i] === 'CURVE')
        convexity_array[i] = utils.sign(
          utils.dpara(
            vert[utils.mod(i - 1, m)],
            vert[i],
            vert[utils.mod(i + 1, m)]
          )
        )
      else convexity_array[i] = 0

    area = 0.0
    cumulative_area[0] = 0.0
    ;[p0] = curve.vertex
    for (i = 0; i < m; i++) {
      next_i = utils.mod(i + 1, m)
      if (curve.tag[next_i] === 'CURVE') {
        alpha = curve.alpha[next_i]
        area +=
          (PENALTY_RATIO *
            alpha *
            (RGBA_COMPONENTS - alpha) *
            utils.dpara(
              curve.c[i * 3 + 2],
              vert[next_i],
              curve.c[next_i * 3 + 2]
            )) /
          2
        area += utils.dpara(p0, curve.c[i * 3 + 2], curve.c[next_i * 3 + 2]) / 2
      }
      cumulative_area[i + 1] = area
    }

    previous[0] = -1
    pen[0] = 0
    len[0] = 0

    for (j = 1; j <= m; j++) {
      previous[j] = j - 1
      pen[j] = pen[j - 1]
      len[j] = len[j - 1] + 1

      for (i = j - 2; i >= 0; i--) {
        should_reject = this.#opti_penalty({
          path,
          i,
          j: utils.mod(j, m),
          res: current_optimization,
          opttolerance: this.#params.optTolerance,
          convc: convexity_array,
          areac: cumulative_area
        })
        if (should_reject) break

        if (
          len[j] > len[i] + 1 ||
          (len[j] === len[i] + 1 && pen[j] > pen[i] + current_optimization.pen)
        ) {
          previous[j] = i
          pen[j] = pen[i] + current_optimization.pen
          len[j] = len[i] + 1
          opt[j] = current_optimization
          current_optimization = new Opti()
        }
      }
    }
    optimized_segment_count = len[m]
    optimized_curve = new Curve(optimized_segment_count)

    j = m
    for (i = optimized_segment_count - 1; i >= 0; i--) {
      if (previous[j] === j - 1) {
        const j_mod = utils.mod(j, m)
        optimized_curve.tag[i] = curve.tag[j_mod]
        const [c0, c1, c2] = [
          curve.c[j_mod * 3 + 0],
          curve.c[j_mod * 3 + 1],
          curve.c[j_mod * 3 + 2]
        ]
        optimized_curve.c[i * 3 + 0] = c0
        optimized_curve.c[i * 3 + 1] = c1
        optimized_curve.c[i * 3 + 2] = c2
        optimized_curve.vertex[i] = curve.vertex[utils.mod(j, m)]
        optimized_curve.alpha[i] = curve.alpha[utils.mod(j, m)]
        optimized_curve.alpha0[i] = curve.alpha0[utils.mod(j, m)]
        optimized_curve.beta[i] = curve.beta[utils.mod(j, m)]
        s_params[i] = t_params[i] = 1.0
      } else {
        optimized_curve.tag[i] = 'CURVE'
        const [c0, c1] = opt[j].c
        optimized_curve.c[i * 3 + 0] = c0
        optimized_curve.c[i * 3 + 1] = c1
        optimized_curve.c[i * 3 + 2] = curve.c[utils.mod(j, m) * 3 + 2]
        optimized_curve.vertex[i] = utils.interval(
          opt[j].s,
          curve.c[utils.mod(j, m) * 3 + 2],
          vert[utils.mod(j, m)]
        )
        optimized_curve.alpha[i] = opt[j].alpha
        optimized_curve.alpha0[i] = opt[j].alpha
        s_params[i] = opt[j].s
        t_params[i] = opt[j].t
      }
      j = previous[j]
    }

    for (i = 0; i < optimized_segment_count; i++) {
      next_i = utils.mod(i + 1, optimized_segment_count)
      optimized_curve.beta[i] = s_params[i] / (s_params[i] + t_params[next_i])
    }

    optimized_curve.alpha_curve = 1
    path.curve = optimized_curve
  }

  /**
   * Calculates penalty for curve optimization
   * @param {Object} params - Parameters object
   * @param {Path} params.path - Path to calculate penalty for
   * @param {number} params.i - Start vertex index
   * @param {number} params.j - End vertex index
   * @param {Opti} params.res - Result object to store optimization data
   * @param {number} params.opttolerance - Optimization tolerance threshold
   * @param {number[]} params.convc - Array of convexity values for each vertex
   * @param {number[]} params.areac - Array of cumulative areas
   * @returns {0|1} 0 if optimization is possible, 1 if optimization should be rejected
   * @description
   * Calculates a penalty value for a potential curve optimization between vertices i and j.
   * The penalty is based on:
   * 1. Deviation from original path points
   * 2. Smoothness of the resulting curve
   * 3. Distribution of control points
   * Returns 1 if the optimization would create an invalid curve.
   */
  #opti_penalty({ path, i, j, res, opttolerance, convc, areac }) {
    const m = path.curve.n
    const { curve } = path
    const { vertex } = curve
    let k
    let next_k
    let k2
    let convexity_sign
    let i1
    let area
    let alpha
    let distance
    let perpendicular_distance
    let perpendicular_distance_vertex
    let bezier_point
    let tangent_param

    if (i === j) return 1

    k = i
    i1 = utils.mod(i + 1, m)
    next_k = utils.mod(k + 1, m)
    convexity_sign = convc[next_k]
    if (convexity_sign === 0) return 1

    distance = utils.ddist(vertex[i], vertex[i1])
    for (k = next_k; k !== j; k = next_k) {
      next_k = utils.mod(k + 1, m)
      k2 = utils.mod(k + 2, m)
      if (convc[next_k] !== convexity_sign) return 1

      if (
        utils.sign(
          utils.cprod(vertex[i], vertex[i1], vertex[next_k], vertex[k2])
        ) !== convexity_sign
      )
        return 1

      if (
        utils.iprod1(vertex[i], vertex[i1], vertex[next_k], vertex[k2]) <
        distance *
          utils.ddist(vertex[next_k], vertex[k2]) *
          TANGENT_PARALLEL_THRESHOLD
      )
        return 1
    }

    const bezier_p0 = curve.c[utils.mod(i, m) * 3 + 2].copy()
    let bezier_p1 = vertex[utils.mod(i + 1, m)].copy()
    let bezier_p2 = vertex[utils.mod(j, m)].copy()
    const bezier_p3 = curve.c[utils.mod(j, m) * 3 + 2].copy()

    area = areac[j] - areac[i]
    area -= utils.dpara(vertex[0], curve.c[i * 3 + 2], curve.c[j * 3 + 2]) / 2
    if (i >= j) area += areac[m]

    const A1 = utils.dpara(bezier_p0, bezier_p1, bezier_p2)
    const A2 = utils.dpara(bezier_p0, bezier_p1, bezier_p3)
    const A3 = utils.dpara(bezier_p0, bezier_p2, bezier_p3)

    const A4 = A1 + A3 - A2

    if (A2 === A1) return 1

    tangent_param = A3 / (A3 - A4)
    const s = A2 / (A2 - A1)
    const A = (A2 * tangent_param) / 2.0

    if (A === 0.0) return 1

    const R = area / A
    alpha = 2 - Math.sqrt(RGBA_COMPONENTS - R / PENALTY_RATIO)

    res.c[0] = utils.interval(tangent_param * alpha, bezier_p0, bezier_p1)
    res.c[1] = utils.interval(s * alpha, bezier_p3, bezier_p2)
    res.alpha = alpha
    res.t = tangent_param
    res.s = s

    bezier_p1 = res.c[0].copy()
    bezier_p2 = res.c[1].copy()

    res.pen = 0

    for (k = utils.mod(i + 1, m); k !== j; k = next_k) {
      next_k = utils.mod(k + 1, m)
      tangent_param = utils.tangent(
        { p0: bezier_p0, p1: bezier_p1, p2: bezier_p2, p3: bezier_p3 },
        { q0: vertex[k], q1: vertex[next_k] }
      )
      if (tangent_param < CURVATURE_THRESHOLD) return 1

      bezier_point = utils.bezier(
        tangent_param,
        bezier_p0,
        bezier_p1,
        bezier_p2,
        bezier_p3
      )
      distance = utils.ddist(vertex[k], vertex[next_k])
      if (distance === 0.0) return 1

      perpendicular_distance =
        utils.dpara(vertex[k], vertex[next_k], bezier_point) / distance
      if (Math.abs(perpendicular_distance) > opttolerance) return 1

      if (
        utils.iprod(vertex[k], vertex[next_k], bezier_point) < 0 ||
        utils.iprod(vertex[next_k], vertex[k], bezier_point) < 0
      )
        return 1

      res.pen += perpendicular_distance * perpendicular_distance
    }

    for (k = i; k !== j; k = next_k) {
      next_k = utils.mod(k + 1, m)
      tangent_param = utils.tangent(
        { p0: bezier_p0, p1: bezier_p1, p2: bezier_p2, p3: bezier_p3 },
        { q0: curve.c[k * 3 + 2], q1: curve.c[next_k * 3 + 2] }
      )
      if (tangent_param < CURVATURE_THRESHOLD) return 1

      bezier_point = utils.bezier(
        tangent_param,
        bezier_p0,
        bezier_p1,
        bezier_p2,
        bezier_p3
      )
      distance = utils.ddist(curve.c[k * 3 + 2], curve.c[next_k * 3 + 2])
      if (distance === 0.0) return 1

      perpendicular_distance =
        utils.dpara(curve.c[k * 3 + 2], curve.c[next_k * 3 + 2], bezier_point) /
        distance
      perpendicular_distance_vertex =
        utils.dpara(
          curve.c[k * 3 + 2],
          curve.c[next_k * 3 + 2],
          vertex[next_k]
        ) / distance
      perpendicular_distance_vertex *= CURVATURE_SCALE * curve.alpha[next_k]
      if (perpendicular_distance_vertex < 0) {
        perpendicular_distance = -perpendicular_distance
        perpendicular_distance_vertex = -perpendicular_distance_vertex
      }
      if (perpendicular_distance < perpendicular_distance_vertex - opttolerance)
        return 1

      if (perpendicular_distance < perpendicular_distance_vertex)
        res.pen +=
          (perpendicular_distance - perpendicular_distance_vertex) *
          (perpendicular_distance - perpendicular_distance_vertex)
    }

    return 0
  }

  /**
   * Processes bitmap into vector paths
   * @returns {void}
   * @throws {Error} If image is not loaded
   * @description
   * Main vectorization process that:
   * 1. Calculates path sums for optimization
   * 2. Determines longest sequences for path optimization
   * 3. Finds optimal polygons for each path
   * 4. Adjusts vertices for smoother curves
   * 5. Applies curve smoothing
   * 6. Optionally optimizes curves for better rendering
   */
  #process_path() {
    for (let i = 0; i < this.#pathlist.length; i++) {
      const path = this.#pathlist[i]
      this.#calc_sums(path)
      this.#calc_lon(path)
      this.#best_polygon(path)
      this.#adjust_vertices(path)

      if (path.sign === '-') this.#reverse(path)

      this.#smooth(path)

      if (this.#params.optCurve) this.#opti_curve(path)
    }
  }

  /**
   * Validates parameters against constraints
   * @param {Partial<PotraceOptions>} params - Parameters to validate
   * @throws {Error} If parameters are invalid with specific reason
   * @returns {void}
   * @description
   * Validates parameters against constraints and throws an error if invalid.
   * Checks for:
   * 1. Valid turn policy values
   * 2. Threshold value within 0-255 range
   * 3. OptCurve is a boolean
   */
  #validate_parameters(params) {
    if (!params) return

    // Validate turnPolicy
    if (
      params.turnPolicy &&
      Potrace.supported_turn_policy_values.indexOf(params.turnPolicy) === -1
    ) {
      const goodVals = `'${Potrace.supported_turn_policy_values.join("', '")}'`
      throw new Error(`Bad turnPolicy value. Allowed values are: ${goodVals}`)
    }

    // Validate threshold
    if (
      params.threshold !== null &&
      params.threshold !== undefined &&
      params.threshold !== Potrace.THRESHOLD_AUTO
    )
      if (
        typeof params.threshold !== 'number' ||
        !utils.between(params.threshold, 0, RGB_MAX)
      )
        throw new Error(
          `Bad threshold value. Expected to be an integer in range 0..${RGB_MAX}`
        )

    // Validate optCurve
    if (
      params.optCurve !== null &&
      params.optCurve !== undefined &&
      typeof params.optCurve !== 'boolean'
    )
      throw new Error("'optCurve' must be Boolean")
  }

  /**
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {void}
   * @description Processes raw image data into a bitmap by converting RGB values to luminance
   */
  #process_loaded_image(image_data) {
    this.#luminance_data = image_data_to_luminance(image_data)
    this.#image_loaded = true
  }

  /**
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {void}
   * @description
   * Loads and initializes image data for processing.
   * Resets loading state, processes image data, and sets loaded flags.
   */
  #load_image(image_data) {
    this.#image_loaded = false
    this.#image_loaded = true
    this.#process_loaded_image(image_data)
  }

  /**
   * @param {PotraceOptions} newParams - New parameters to validate and set
   * @throws {Error} If parameters are invalid
   * @returns {void}
   * @description
   * Validates and sets new parameters.
   * Validates parameters against constraints and updates internal state.
   * Marks processing as needed if relevant parameters change.
   */
  #set_parameters(newParams) {
    this.#validate_parameters(newParams)

    for (const key in this.#params) {
      if (!this.#params.hasOwnProperty(key)) continue
      if (!newParams.hasOwnProperty(key)) continue

      const tmpOldVal = this.#params[key]
      this.#params[key] = newParams[key]

      const isNonVisualParam = ['color', 'background'].indexOf(key) === -1
      if (tmpOldVal !== this.#params[key] && isNonVisualParam)
        this.#processed = false
    }

    if (
      this.#params.steps &&
      !Array.isArray(this.#params.steps) &&
      (!utils.is_number(this.#params.steps) ||
        !utils.between(this.#params.steps, 1, RGB_MAX))
    )
      throw new Error("Bad 'steps' value")

    this.#calculated_threshold = null
  }

  /**
   * Adds an extra color stop for better gradient transitions
   * @param {Array<{value: number, colorIntensity: number}>} ranges - Current color ranges
   * @returns {Array<{value: number, colorIntensity: number}>} Modified color ranges with extra stop
   * @description
   * Improves color transitions by:
   * 1. Analyzing the last color range
   * 2. Adding an intermediate stop if the range is too wide
   * 3. Calculating appropriate color intensity for the new stop
   */
  #add_extra_color_stop(ranges) {
    const { blackOnWhite } = this.#params
    const lastColorStop = ranges[ranges.length - 1]
    const lastRangeFrom = blackOnWhite ? 0 : lastColorStop.value
    const lastRangeTo = blackOnWhite ? lastColorStop.value : RGB_MAX

    // Early return if range is too small or already at max intensity
    if (
      lastRangeTo - lastRangeFrom <= POSTERIZE_LEVEL_STEP ||
      lastColorStop.colorIntensity === 1
    )
      return ranges

    const histogram = this.#get_image_histogram()
    const { levels } = histogram.get_stats(lastRangeFrom, lastRangeTo)

    let newColorStop
    if (levels.mean + levels.stdDev <= POSTERIZE_LEVEL_STEP)
      newColorStop = levels.mean + levels.stdDev
    else if (levels.mean - levels.stdDev <= POSTERIZE_LEVEL_STEP)
      newColorStop = levels.mean - levels.stdDev
    else newColorStop = POSTERIZE_LEVEL_STEP

    const newStats = blackOnWhite
      ? histogram.get_stats(0, newColorStop)
      : histogram.get_stats(newColorStop, RGB_MAX)
    const color = newStats.levels.mean

    ranges.push({
      value: Math.abs((blackOnWhite ? 0 : RGB_MAX) - newColorStop),
      colorIntensity: isNaN(color)
        ? 0
        : (blackOnWhite ? RGB_MAX - color : color) / RGB_MAX
    })

    return ranges
  }

  /**
   * Calculates color intensity value for a single color
   * @param {number} color - Color value
   * @param {boolean} blackOnWhite - Whether to invert the color
   * @returns {number} Normalized color intensity (0-1)
   */
  #calc_color_intensity_value(color, blackOnWhite) {
    return (blackOnWhite ? RGB_MAX - color : color) / RGB_MAX
  }

  /**
   * Calculates color intensity values for threshold ranges
   * @param {number[]} colorStops - Array of threshold values
   * @returns {Array<{value: number, colorIntensity: number}>} Color stops with calculated intensities
   * @description
   * For each color stop:
   * 1. Determines the range boundaries
   * 2. Applies the selected fill strategy (spread, dominant, mean, median)
   * 3. Calculates color intensity based on the strategy
   * 4. Ensures proper spacing between colors
   */
  #calc_color_intensity(colorStops) {
    const { blackOnWhite } = this.#params
    const colorSelectionStrat = this.#params.fillStrategy
    const histogram =
      colorSelectionStrat !== Potrace.FILL_SPREAD
        ? this.#get_image_histogram()
        : null
    const threshold_value = this.#param_threshold()
    const fullRange = Math.abs(
      threshold_value - (blackOnWhite ? 0 : RGB_MAX)
    )

    return colorStops.map((threshold, index) => {
      let nextValue
      if (index + 1 === colorStops.length)
        nextValue = blackOnWhite ? -1 : COLOR_SPACE_SIZE
      else nextValue = colorStops[index + 1]

      const rangeStart = Math.round(blackOnWhite ? nextValue + 1 : threshold)
      const rangeEnd = Math.round(blackOnWhite ? threshold : nextValue - 1)
      const factor = index / (colorStops.length - 1)
      const intervalSize = rangeEnd - rangeStart
      const stats = histogram.get_stats(rangeStart, rangeEnd)
      let color = -1

      if (stats.pixels === 0)
        return {
          value: threshold,
          colorIntensity: 0
        }

      switch (colorSelectionStrat) {
        case Potrace.FILL_SPREAD:
          // We want it to be 0 (255 when white on black) at the most saturated end, so...
          color =
            (blackOnWhite ? rangeStart : rangeEnd) +
            (blackOnWhite ? 1 : -1) *
              intervalSize *
              Math.max(HALF, fullRange / RGB_MAX) *
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
      if (index !== 0)
        color = blackOnWhite
          ? utils.clamp(
              color,
              rangeStart,
              rangeEnd - Math.round(intervalSize * POSTERIZE_STEP_SCALE)
            )
          : utils.clamp(
              color,
              rangeStart + Math.round(intervalSize * POSTERIZE_STEP_SCALE),
              rangeEnd
            )

      return {
        value: threshold,
        colorIntensity:
          color === -1
            ? 0
            : this.#calc_color_intensity_value(color, blackOnWhite)
      }
    })
  }

  /**
   * @returns {Histogram} Image histogram
   * @description
   * Retrieves the image histogram. If it doesn't exist, creates and initializes it.
   */
  #get_image_histogram() {
    // If histogram doesn't exist yet, create it
    if (!this.#luminance_data.histogram()) {
      const histogram = new Histogram(this.#luminance_data)
      this.#luminance_data.set_histogram(histogram)
    }
    return this.#luminance_data.histogram()
  }

  /**
   * Gets ranges for posterization
   * @returns {Array<Object>} Color ranges
   * @description
   * Determines the color ranges for posterization based on the specified parameters.
   * If steps are provided as an array, uses those values.
   * If steps are set to Potrace.STEPS_AUTO, calculates the number of steps automatically.
   * If rangeDistribution is set to Potrace.RANGES_AUTO, uses auto-calculated ranges.
   * Otherwise, uses equally distributed ranges.
   */
  #get_ranges() {
    const steps = this.#param_steps()

    if (!Array.isArray(steps))
      return this.#params.rangeDistribution === Potrace.RANGES_AUTO
        ? this.#get_ranges_auto()
        : this.#get_ranges_equally_distributed()

    let colorStops = []
    const threshold = this.#param_threshold()
    const lookingForDarkPixels = this.#params.blackOnWhite

    steps.forEach(item => {
      if (colorStops.indexOf(item) === -1 && utils.between(item, 0, RGB_MAX))
        colorStops.push(item)
    })

    if (!colorStops.length) colorStops.push(threshold)

    colorStops = colorStops.sort((a, b) =>
      a < b === lookingForDarkPixels ? 1 : -1
    )

    if (lookingForDarkPixels && colorStops[0] < threshold)
      colorStops.unshift(threshold)
    else if (
      !lookingForDarkPixels &&
      colorStops[colorStops.length - 1] < threshold
    )
      colorStops.push(threshold)

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * Gets auto-calculated ranges for color posterization
   * @returns {Array<{value: number, colorIntensity: number}>} Array of color ranges with thresholds and intensities
   * @description
   * Calculates optimal color ranges for posterization by:
   * 1. Using histogram analysis to find natural color breaks
   * 2. Applying multilevel thresholding when auto threshold is enabled
   * 3. Adjusting ranges based on black/white preference
   */
  #get_ranges_auto() {
    const histogram = this.#get_image_histogram()
    const steps = this.#param_steps(true)
    if (typeof steps !== 'number') return this.#calc_color_intensity([])
    let colorStops

    if (this.#params.threshold === Potrace.THRESHOLD_AUTO)
      colorStops = histogram.multilevel_thresholding(steps)
    else {
      const threshold = this.#param_threshold()

      colorStops = this.#params.blackOnWhite
        ? histogram.multilevel_thresholding(steps - 1, 0, threshold)
        : histogram.multilevel_thresholding(steps - 1, threshold, RGB_MAX)

      if (this.#params.blackOnWhite) colorStops.push(threshold)
      else colorStops.unshift(threshold)
    }

    if (this.#params.blackOnWhite) colorStops = colorStops.reverse()

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * Gets equally distributed ranges for color posterization
   * @returns {Array<{value: number, colorIntensity: number}>} Array of evenly spaced color ranges
   * @description
   * Creates color ranges by:
   * 1. Dividing the available color space into equal steps
   * 2. Calculating appropriate thresholds for each step
   * 3. Computing color intensities for each range
   */
  #get_ranges_equally_distributed() {
    const { blackOnWhite } = this.#params
    const colorsToThreshold = blackOnWhite
      ? this.#param_threshold()
      : RGB_MAX - this.#param_threshold()
    const steps = this.#param_steps()
    if (typeof steps !== 'number') return this.#calc_color_intensity([])

    const stepSize = colorsToThreshold / steps
    const colorStops = []
    let i = steps - 1

    while (i >= 0) {
      const threshold = Math.min(colorsToThreshold, (i + 1) * stepSize)
      const finalThreshold = blackOnWhite ? threshold : RGB_MAX - threshold
      i--

      colorStops.push(finalThreshold)
    }

    return this.#calc_color_intensity(colorStops)
  }

  /**
   * Validates and processes step parameters
   * @param {boolean} [count=false] - Whether to return the count instead of steps
   * @returns {number|number[]} Processed steps value or count
   * @description
   * Processes step parameters by:
   * 1. Handling array input
   * 2. Calculating automatic step count based on threshold
   * 3. Ensuring step count is within valid range
   * 4. Adjusting steps based on available colors
   */
  #param_steps(count) {
    const { steps } = this.#params

    if (Array.isArray(steps)) return count ? steps.length : steps

    if (
      steps === Potrace.STEPS_AUTO &&
      this.#params.threshold === Potrace.THRESHOLD_AUTO
    )
      return RGBA_COMPONENTS

    const { blackOnWhite } = this.#params
    const colorsCount = blackOnWhite
      ? this.#param_threshold()
      : RGB_MAX - this.#param_threshold()

    if (steps === Potrace.STEPS_AUTO) {
      if (colorsCount > POSTERIZE_BRIGHTNESS_THRESHOLD) return RGBA_COMPONENTS
      return 3
    }
    if (typeof steps !== 'number') return RGBA_COMPONENTS
    return Math.min(colorsCount, Math.max(2, steps))
  }

  /**
   * Gets valid threshold parameter considering auto-threshold
   * @returns {number} Calculated threshold value between 0 and RGB_MAX
   * @description
   * Determines the appropriate threshold by:
   * 1. Using cached value if available
   * 2. Using specified threshold if not auto
   * 3. Calculating optimal threshold using multilevel thresholding
   * 4. Defaulting to ALPHA_TRANSPARENCY_THRESHOLD if calculation fails
   */
  #param_threshold() {
    if (this.#calculated_threshold !== null) return this.#calculated_threshold

    if (this.#params.threshold !== Potrace.THRESHOLD_AUTO) {
      if (typeof this.#params.threshold !== 'number') return ALPHA_TRANSPARENCY_THRESHOLD
      this.#calculated_threshold = this.#params.threshold
      return this.#calculated_threshold
    }

    const twoThresholds = this.#get_image_histogram().multilevel_thresholding(2)
    this.#calculated_threshold = this.#params.blackOnWhite
      ? twoThresholds[1]
      : twoThresholds[0]
    this.#calculated_threshold =
      this.#calculated_threshold || ALPHA_TRANSPARENCY_THRESHOLD

    return this.#calculated_threshold
  }

  /**
   * Gets path tag for SVG output
   * @returns {string} SVG path tag
   * @throws {Error} If image not loaded
   * @description
   * Generates an SVG path tag for the processed image.
   */
  get_path_tag() {
    if (!this.#image_loaded) throw new Error('Image should be loaded first')

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
   * Generates SVG path tags for each color level
   * @returns {string[]} Array of SVG path tags with opacity and color
   * @description
   * Creates path tags by:
   * 1. Getting color ranges
   * 2. Calculating appropriate opacity for each layer
   * 3. Generating path data for each threshold
   * 4. Adding fill and opacity attributes
   */
  path_tags() {
    let ranges = this.#get_ranges()
    const { blackOnWhite } = this.#params

    if (ranges.length >= MIN_RANGE_COUNT)
      ranges = this.#add_extra_color_stop(ranges)

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

      let element = this.get_path_tag()
      element = utils.set_html_attr(
        element,
        'fill-opacity',
        calculatedOpacity.toFixed(3)
      )

      const canBeIgnored =
        calculatedOpacity === 0 || element.indexOf(' d=""') !== -1

      const c = Math.round(
        Math.abs((blackOnWhite ? RGB_MAX : 0) - RGB_MAX * thisLayerOpacity)
      )
      element = utils.set_html_attr(element, 'fill', `rgb(${c}, ${c}, ${c})`)

      return canBeIgnored ? '' : element
    })
  }

  /**
   * Gets path data for SVG output
   * @param {string} [fillColor] - Override fill color (any valid CSS color)
   * @returns {string} SVG path data string
   * @throws {Error} If image not loaded
   * @description
   * Generates SVG path data for the processed image.
   * If fillColor is provided, it overrides the default fill color.
   * If fillColor is not provided, it uses the color specified in the parameters.
   * If the color is set to Potrace.COLOR_AUTO, it automatically determines the fill color based on the blackOnWhite parameter.
   * Throws an error if the image is not loaded.
   */
  get_path_data(fillColor) {
    const fill = arguments.length === 0 ? this.#params.color : fillColor

    let resolved_fill
    if (fill === Potrace.COLOR_AUTO)
      resolved_fill = this.#params.blackOnWhite ? 'black' : 'white'
    else resolved_fill = fill

    if (!this.#image_loaded) throw new Error('Image should be loaded first')

    if (!this.#processed) {
      this.#bitmap_to_pathlist()
      this.#process_path()
      this.#processed = true
    }

    return this.#pathlist.map(path => utils.render_curve(path.curve, 1)).join('')
  }

  /**
   * Converts the loaded image into an array of curve paths
   * @returns {PathData[]} Array of path objects with SVG path data and opacity
   * @throws {Error} If image not loaded
   * @description
   * Converts the loaded image into an array of curve paths.
   * Each path object contains the SVG path data and opacity for a specific color level.
   * Throws an error if the image is not loaded.
   */
  as_curves() {
    const ranges = this.#get_ranges()
    const { blackOnWhite } = this.#params

    this.#set_parameters({ blackOnWhite })

    let actualPrevLayersOpacity = 0

    return ranges
      .map(colorStop => {
        const thisLayerOpacity = colorStop.colorIntensity

        if (thisLayerOpacity === 0) return null

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

        const path_data = this.get_path_tag()
        const d_match = path_data.match(/d="([^"]+)"/)
        const d = d_match ? d_match[1] : ''
        return {
          d,
          fillOpacity: calculatedOpacity.toFixed(3)
        }
      })
      .filter(item => item !== null)
  }

  /**
   * Loads and processes image data for tracing
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   */
  load_image(image_data) {
    this.#load_image(image_data)
  }

  /**
   * Creates paths from image data
   * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
   * @returns {ProcessedPaths} Processed path data
   * @throws {Error} If image cannot be processed
   * @description
   * Processes the image data and creates an array of curve paths.
   * Each path object contains the SVG path data and opacity for a specific color level.
   * Throws an error if the image cannot be processed.
   */
  create_paths(image_data) {
    this.#load_image(image_data)
    const { width } = this.#luminance_data
    const { height } = this.#luminance_data
    const dark = !this.#params.blackOnWhite
    const paths = this.as_curves()
    return { width, height, dark, paths }
  }
}

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
 * Converts an image into single path element
 * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
 * @param {PotraceOptions} [options={}] - Potrace options
 * @returns {string} SVG path data
 */
export const as_path_element = (image_data, options = {}) => {
  const potrace = new Potrace(options)
  potrace.load_image(image_data)
  return potrace.get_path_tag()
}

/**
 * Converts an image into path elements
 * @param {ImageData} image_data - Canvas ImageData object containing the image pixels
 * @param {PotraceOptions} [options={}] - Potrace options
 * @returns {string[]} SVG path elements
 */
export const as_path_elements = (image_data, options = {}) => {
  const potrace = new Potrace(options)
  potrace.load_image(image_data)
  return potrace.path_tags()
}

export default {
  as_paths,
  as_path_element,
  as_path_elements,
  Potrace
}
