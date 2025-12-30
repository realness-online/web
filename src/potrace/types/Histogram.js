/**
 * Histogram
 *
 * @param {ImageData|Bitmap|number} image_source - Image data to collect pixel data from, or Bitmap instance, or integer to create empty histogram
 * @param [mode] Used for ImageData. Specifies which channel to use (r,g,b,luminance)
 * @constructor
 * @protected
 */

import utils from '@/potrace/utils'
import Bitmap from '@/potrace/types/Bitmap'

// Constants
const COLOR_DEPTH = 256
const COLOR_RANGE_END = COLOR_DEPTH - 1
const RGBA_COMPONENTS = 4
const BIT_SHIFT_8 = 8
const BIT_SHIFT_16 = 16
const INDEX_OFFSET = -2

/**
 * 1D Histogram
 *
 * @param {ImageData|Bitmap|number} image_source - Image data to collect pixel data from, or Bitmap instance, or integer to create empty histogram
 * @param [mode] Used for ImageData. Specifies which channel to use (r,g,b,luminance)
 * @constructor
 * @protected
 */
class Histogram {
  static MODE_LUMINANCE = 'luminance'
  static MODE_R = 'r'
  static MODE_G = 'g'
  static MODE_B = 'b'

  // Reusable arrays for thresholding calculations
  static SHARED_ARRAYS = {
    p: new Float64Array(COLOR_DEPTH * COLOR_DEPTH),
    s: new Float64Array(COLOR_DEPTH * COLOR_DEPTH),
    h: new Float64Array(COLOR_DEPTH * COLOR_DEPTH),
    indexes: new Array(COLOR_DEPTH)
  }

  // Use regular properties for better performance in hot paths
  sorted_indexes = null
  cached_stats = {}
  lookup_table_h = null
  data = null
  pixels = 0

  constructor(image_source, mode) {
    if (typeof image_source === 'number') this.#create_array(image_source)
    else if (image_source instanceof Bitmap)
      this.#collect_values_bitmap(image_source)
    else if (image_source instanceof ImageData)
      this.#collect_values_image_data(image_source, mode)
    else throw new Error('Unsupported image source')
  }

  /**
   * Creates a typed array based on image size
   * @param {number} image_size - Size of the image
   * @returns {Uint8Array|Uint16Array|Uint32Array} - Appropriate typed array for the image size
   */
  #create_array(image_size) {
    let array_type
    if (image_size <= Math.pow(2, BIT_SHIFT_8)) array_type = Uint8Array
    else if (image_size <= Math.pow(2, BIT_SHIFT_16)) array_type = Uint16Array
    else array_type = Uint32Array

    this.pixels = image_size
    return (this.data = new array_type(COLOR_DEPTH))
  }

  /**
   * Collects pixel values from ImageData
   * @param {ImageData} source - Source image data
   * @param {string} mode - Color mode to use (r, g, b, or luminance)
   */
  #collect_values_image_data(source, mode) {
    const pixel_data = source.data
    const data = this.#create_array(source.width * source.height)
    const { width } = source
    const { height } = source

    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * RGBA_COMPONENTS
        let val
        if (mode === Histogram.MODE_R) val = pixel_data[idx]
        else if (mode === Histogram.MODE_G) val = pixel_data[idx + 1]
        else if (mode === Histogram.MODE_B) val = pixel_data[idx + 2]
        else
          val = utils.luminance(
            pixel_data[idx],
            pixel_data[idx + 1],
            pixel_data[idx + 2]
          )

        data[val]++
      }
  }

  /**
   * Collects color values from a Bitmap instance
   * @param {Bitmap} source - Source bitmap
   */
  #collect_values_bitmap(source) {
    const data = this.#create_array(source.size)
    const len = source.data.length

    for (let i = 0; i < len; i++) {
      const color = source.data[i]
      data[color]++
    }
  }

  /**
   * Gets array of color indexes in ascending order
   * @param {boolean} [refresh=false] - Whether to refresh the cached sorted indexes
   * @returns {Array} Array of sorted color indexes
   */
  get_sorted_indexes(refresh = false) {
    if (!refresh && this.sorted_indexes) return this.sorted_indexes

    const { data } = this
    const { indexes } = Histogram.SHARED_ARRAYS

    // Traditional for loop is faster than forEach
    for (let i = 0; i < COLOR_DEPTH; i++) indexes[i] = i

    // Use regular function for better performance in sort
    indexes.sort((a, b) => {
      if (data[a] > data[b]) return 1
      if (data[a] < data[b]) return -1
      return 0
    })

    this.sorted_indexes = indexes.slice() // Create a copy to preserve the shared array
    return this.sorted_indexes
  }

  /**
   * Builds lookup table H from lookup tables P and S
   * See {@link http://www.iis.sinica.edu.tw/page/jise/2001/200109_01.pdf|this paper} for more details
   * @returns {Float64Array} Lookup table H
   */
  thresholding_build_lookup_table() {
    const { p, s, h } = Histogram.SHARED_ARRAYS
    const pixels_total = this.pixels

    // Clear arrays
    p.fill(0)
    s.fill(0)
    h.fill(0)

    // Use traditional for loops for better performance
    for (let i = 1; i < COLOR_DEPTH; ++i) {
      const idx = index(i, i)
      const tmp = this.data[i] / pixels_total

      p[idx] = tmp
      s[idx] = i * tmp
    }

    for (let i = 1; i < COLOR_DEPTH - 1; ++i) {
      const tmp = this.data[i + 1] / pixels_total
      const idx = index(1, i)

      p[idx + 1] = p[idx] + tmp
      s[idx + 1] = s[idx] + (i + 1) * tmp
    }

    for (let i = 2; i < COLOR_DEPTH; i++)
      for (let j = i + 1; j < COLOR_DEPTH; j++) {
        p[index(i, j)] = p[index(1, j)] - p[index(1, i - 1)]
        s[index(i, j)] = s[index(1, j)] - s[index(1, i - 1)]
      }

    for (let i = 1; i < COLOR_DEPTH; ++i)
      for (let j = i + 1; j < COLOR_DEPTH; j++) {
        const idx = index(i, j)
        h[idx] = p[idx] !== 0 ? (s[idx] * s[idx]) / p[idx] : 0
      }

    this.lookup_table_h = h.slice() // Create a copy to preserve the shared array
    return this.lookup_table_h
  }

  /**
   * Implements Algorithm For Multilevel Thresholding
   * Receives desired number of color stops, returns array of said size. Could be limited to a range levelMin..levelMax
   *
   * Regardless of levelMin and levelMax values it still relies on between class variances for the entire histogram
   *
   * @param amount - how many thresholds should be calculated
   * @param [levelMin=0] - histogram segment start
   * @param [levelMax=255] - histogram segment end
   * @returns {number[]}
   */
  multilevel_thresholding(amount, level_min, level_max) {
    const [min, max] = normalize_min_max(level_min, level_max)
    const threshold_amount = Math.min(max - min - 2, ~~amount)

    if (threshold_amount < 1) return []
    if (!this.lookup_table_h) this.thresholding_build_lookup_table()

    const stack = [
      {
        starting_point: min || 0,
        prev_variance: 0,
        indexes: new Array(threshold_amount),
        depth: 0,
        max_sig: 0,
        color_stops: null
      }
    ]

    const best_result = { max_sig: 0, color_stops: null }

    while (stack.length > 0) {
      const current = stack.pop()
      const { starting_point, prev_variance, indexes, depth } = current

      for (
        let i = starting_point + 1;
        i < max - threshold_amount + depth;
        i++
      ) {
        const variance =
          prev_variance + this.lookup_table_h[index(starting_point + 1, i)]
        indexes[depth] = i

        if (depth + 1 < threshold_amount)
          stack.push({
            starting_point: i,
            prev_variance: variance,
            indexes: indexes.slice(),
            depth: depth + 1,
            max_sig: current.max_sig,
            color_stops: current.color_stops
          })
        else {
          const total_variance =
            variance + this.lookup_table_h[index(i + 1, max)]
          if (total_variance > best_result.max_sig) {
            best_result.max_sig = total_variance
            best_result.color_stops = indexes.slice()
          }
        }
      }
    }

    return best_result.color_stops || []
  }

  /**
   * Automatically finds threshold value using Algorithm For Multilevel Thresholding
   *
   * @param {number} [level_min]
   * @param {number} [level_max]
   * @returns {null|number}
   */
  auto_threshold(level_min, level_max) {
    const value = this.multilevel_thresholding(1, level_min, level_max)
    return value.length ? value[0] : null
  }

  /**
   * Returns dominant color in given range. Returns -1 if not a single color from the range present on the image
   *
   * @param [levelMin=0]
   * @param [levelMax=255]
   * @param [tolerance=1]
   * @returns {number}
   */
  get_dominant_color(level_min, level_max, tolerance) {
    const [min, max] = normalize_min_max(level_min, level_max)
    const tol = tolerance || 1

    const colors = this.data
    let dominant_index = -1
    let dominant_value = -1
    let tmp

    if (min === max) return colors[min] ? min : -1

    for (let i = min; i <= max; i++) {
      tmp = 0

      for (let j = ~~(tol / INDEX_OFFSET); j < tol; j++)
        tmp += utils.between(i + j, 0, COLOR_RANGE_END) ? colors[i + j] : 0

      const summ_is_bigger = tmp > dominant_value
      const summ_equal_but_main_color_is_bigger =
        dominant_value === tmp &&
        (dominant_index < 0 || colors[i] > colors[dominant_index])

      if (summ_is_bigger || summ_equal_but_main_color_is_bigger) {
        dominant_index = i
        dominant_value = tmp
      }
    }

    return dominant_value <= 0 ? -1 : dominant_index
  }

  /**
   * Returns stats for histogram or its segment.
   *
   * Returned object contains median, mean and standard deviation for pixel values;
   * peak, mean and median number of pixels per level and few other values
   *
   * If no pixels colors from specified range present on the image - most values will be NaN
   *
   * @param {number} [level_min=0] - histogram segment start
   * @param {number} [level_max=255] - histogram segment end
   * @param {boolean} [refresh=false] - if cached result can be returned
   * @returns {{levels: {mean: (number|*), median: *, stdDev: number, unique: number}, pixelsPerLevel: {mean: (number|*), median: (number|*), peak: number}, pixels: number}}
   */
  get_stats(level_min, level_max, refresh) {
    const [min, max] = normalize_min_max(level_min, level_max)

    if (!refresh && this.cached_stats[`${min}-${max}`])
      return this.cached_stats[`${min}-${max}`]

    const { data } = this
    const sorted_indexes = this.get_sorted_indexes(false)

    let pixels_total = 0
    let median_value = null
    let tmp_sum_of_deviations = 0
    let tmp_pixels_iterated = 0
    let all_pixel_values_combined = 0
    let unique_values = 0 // counter for levels that's represented by at least one pixel
    let most_pixels_per_level = 0

    // Finding number of pixels and mean
    for (let i = min; i <= max; i++) {
      pixels_total += data[i]
      all_pixel_values_combined += data[i] * i

      unique_values += data[i] === 0 ? 0 : 1

      if (most_pixels_per_level < data[i]) most_pixels_per_level = data[i]
    }

    const mean_value = all_pixel_values_combined / pixels_total
    const pixels_per_level_mean = pixels_total / (max - min)
    const pixels_per_level_median = pixels_total / unique_values
    const median_pixel_index = Math.floor(pixels_total / 2)

    // Finding median and standard deviation
    for (let i = 0; i < COLOR_DEPTH; i++) {
      const tmp_pixel_value = sorted_indexes[i]
      const tmp_pixels = data[tmp_pixel_value]

      if (tmp_pixel_value < min || tmp_pixel_value > max) continue

      tmp_pixels_iterated += tmp_pixels
      tmp_sum_of_deviations +=
        Math.pow(tmp_pixel_value - mean_value, 2) * tmp_pixels

      if (median_value === null && tmp_pixels_iterated >= median_pixel_index)
        median_value = tmp_pixel_value
    }

    return (this.cached_stats[`${min}-${max}`] = {
      levels: {
        mean: mean_value,
        median: median_value,
        stdDev: Math.sqrt(tmp_sum_of_deviations / pixels_total),
        unique: unique_values
      },
      pixelsPerLevel: {
        mean: pixels_per_level_mean,
        median: pixels_per_level_median,
        peak: most_pixels_per_level
      },
      pixels: pixels_total
    })
  }
}

/**
 * Calculates array index for pair of indexes. We multiple column (x) by 256 and then add row to it,
 * this way `(index(i, j) + 1) === index(i, j + i)` thus we can reuse `index(i, j)` we once calculated
 *
 * Note: this is different from how indexes calculated in {@link Bitmap} class, keep it in mind.
 *
 * @param x
 * @param y
 * @returns {*}
 * @private
 */
const index = (x, y) => COLOR_DEPTH * x + y

/**
 * Shared parameter normalization for methods 'multilevel_thresholding', 'auto_threshold', 'get_dominant_color' and 'get_stats'
 *
 * @param level_min
 * @param level_max
 * @returns {number[]}
 * @private
 */
const normalize_min_max = (level_min, level_max) => {
  const min =
    typeof level_min === 'number'
      ? utils.clamp(Math.round(level_min), 0, COLOR_RANGE_END)
      : 0

  const max =
    typeof level_max === 'number'
      ? utils.clamp(Math.round(level_max), 0, COLOR_RANGE_END)
      : COLOR_RANGE_END

  if (min > max) throw new Error(`Invalid range "${min}...${max}"`)

  return [min, max]
}

export default Histogram
