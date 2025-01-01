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
const COLOR_DEPTH = 256
const COLOR_RANGE_END = COLOR_DEPTH - 1

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
    if (typeof image_source === 'number') {
      this.#create_array(image_source)
    } else if (image_source instanceof Bitmap) {
      this.#collect_values_bitmap(image_source)
    } else if (image_source instanceof ImageData) {
      this.#collect_values_image_data(image_source, mode)
    } else {
      throw new Error('Unsupported image source')
    }
  }

  /**
   * Creates a typed array based on image size
   * @param {number} image_size - Size of the image
   * @returns {Uint8Array|Uint16Array|Uint32Array} - Appropriate typed array for the image size
   * @private
   */
  #create_array(image_size) {
    const array_type =
      image_size <= Math.pow(2, 8)
        ? Uint8Array
        : image_size <= Math.pow(2, 16)
          ? Uint16Array
          : Uint32Array

    this.pixels = image_size
    return (this.data = new array_type(COLOR_DEPTH))
  }

  /**
   * Collects pixel values from ImageData
   * @param {ImageData} source - Source image data
   * @param {string} mode - Color mode to use (r, g, b, or luminance)
   * @private
   */
  #collect_values_image_data(source, mode) {
    const pixel_data = source.data
    const data = this.#create_array(source.width * source.height)
    const width = source.width
    const height = source.height

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const val =
          mode === Histogram.MODE_R
            ? pixel_data[idx]
            : mode === Histogram.MODE_G
              ? pixel_data[idx + 1]
              : mode === Histogram.MODE_B
                ? pixel_data[idx + 2]
                : utils.luminance(
                    pixel_data[idx],
                    pixel_data[idx + 1],
                    pixel_data[idx + 2]
                  )

        data[val]++
      }
    }
  }

  /**
   * Collects color values from a Bitmap instance
   * @param {Bitmap} source - Source bitmap
   * @private
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
   * @param {boolean} refresh - Whether to refresh the cached sorted indexes
   * @returns {Array} Array of sorted color indexes
   * @private
   */
  get_sorted_indexes(refresh) {
    if (!refresh && this.sorted_indexes) return this.sorted_indexes

    const data = this.data
    const indexes = Histogram.SHARED_ARRAYS.indexes

    // Traditional for loop is faster than forEach
    for (let i = 0; i < COLOR_DEPTH; i++) {
      indexes[i] = i
    }

    // Use regular function for better performance in sort
    indexes.sort(function (a, b) {
      return data[a] > data[b] ? 1 : data[a] < data[b] ? -1 : 0
    })

    this.sorted_indexes = indexes.slice() // Create a copy to preserve the shared array
    return this.sorted_indexes
  }

  /**
   * Builds lookup table H from lookup tables P and S
   * See {@link http://www.iis.sinica.edu.tw/page/jise/2001/200109_01.pdf|this paper} for more details
   * @returns {Float64Array} Lookup table H
   * @private
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

    for (let i = 2; i < COLOR_DEPTH; i++) {
      for (let j = i + 1; j < COLOR_DEPTH; j++) {
        p[index(i, j)] = p[index(1, j)] - p[index(1, i - 1)]
        s[index(i, j)] = s[index(1, j)] - s[index(1, i - 1)]
      }
    }

    for (let i = 1; i < COLOR_DEPTH; ++i) {
      for (let j = i + 1; j < COLOR_DEPTH; j++) {
        const idx = index(i, j)
        h[idx] = p[idx] !== 0 ? (s[idx] * s[idx]) / p[idx] : 0
      }
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
    ;[level_min, level_max] = normalize_min_max(level_min, level_max)
    amount = Math.min(level_max - level_min - 2, ~~amount)

    if (amount < 1) return []
    if (!this.lookup_table_h) {
      this.thresholding_build_lookup_table()
    }

    const stack = [
      {
        starting_point: level_min || 0,
        prev_variance: 0,
        indexes: new Array(amount),
        depth: 0,
        max_sig: 0,
        color_stops: null
      }
    ]

    const best_result = { max_sig: 0, color_stops: null }

    while (stack.length > 0) {
      const current = stack.pop()
      const { starting_point, prev_variance, indexes, depth } = current

      for (let i = starting_point + 1; i < level_max - amount + depth; i++) {
        const variance =
          prev_variance + this.lookup_table_h[index(starting_point + 1, i)]
        indexes[depth] = i

        if (depth + 1 < amount) {
          stack.push({
            starting_point: i,
            prev_variance: variance,
            indexes: indexes.slice(),
            depth: depth + 1,
            max_sig: current.max_sig,
            color_stops: current.color_stops
          })
        } else {
          const total_variance =
            variance + this.lookup_table_h[index(i + 1, level_max)]
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
   * @param {number} [levelMin]
   * @param {number} [levelMax]
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
    ;[level_min, level_max] = normalize_min_max(level_min, level_max)
    tolerance = tolerance || 1

    const colors = this.data
    let dominant_index = -1
    let dominant_value = -1
    let tmp

    if (level_min === level_max) {
      return colors[level_min] ? level_min : -1
    }

    for (let i = level_min; i <= level_max; i++) {
      tmp = 0

      for (let j = ~~(tolerance / -2); j < tolerance; j++) {
        tmp += utils.between(i + j, 0, COLOR_RANGE_END) ? colors[i + j] : 0
      }

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
   * @param {Number} [levelMin=0] - histogram segment start
   * @param {Number} [levelMax=255] - histogram segment end
   * @param {Boolean} [refresh=false] - if cached result can be returned
   * @returns {{levels: {mean: (number|*), median: *, stdDev: number, unique: number}, pixelsPerLevel: {mean: (number|*), median: (number|*), peak: number}, pixels: number}}
   */
  get_stats(level_min, level_max, refresh) {
    ;[level_min, level_max] = normalize_min_max(level_min, level_max)

    if (!refresh && this.cached_stats[level_min + '-' + level_max])
      return this.cached_stats[level_min + '-' + level_max]

    const data = this.data
    const sorted_indexes = this.get_sorted_indexes()

    let pixels_total = 0
    let median_value = null
    let mean_value
    let median_pixel_index
    let pixels_per_level_mean
    let pixels_per_level_median
    let tmp_sum_of_deviations = 0
    let tmp_pixels_iterated = 0
    let all_pixel_values_combined = 0
    let unique_values = 0 // counter for levels that's represented by at least one pixel
    let most_pixels_per_level = 0

    // Finding number of pixels and mean
    for (let i = level_min; i <= level_max; i++) {
      pixels_total += data[i]
      all_pixel_values_combined += data[i] * i

      unique_values += data[i] === 0 ? 0 : 1

      if (most_pixels_per_level < data[i]) {
        most_pixels_per_level = data[i]
      }
    }

    mean_value = all_pixel_values_combined / pixels_total
    pixels_per_level_mean = pixels_total / (level_max - level_min)
    pixels_per_level_median = pixels_total / unique_values
    median_pixel_index = Math.floor(pixels_total / 2)

    // Finding median and standard deviation
    for (let i = 0; i < COLOR_DEPTH; i++) {
      const tmp_pixel_value = sorted_indexes[i]
      const tmp_pixels = data[tmp_pixel_value]

      if (tmp_pixel_value < level_min || tmp_pixel_value > level_max) continue

      tmp_pixels_iterated += tmp_pixels
      tmp_sum_of_deviations +=
        Math.pow(tmp_pixel_value - mean_value, 2) * tmp_pixels

      if (median_value === null && tmp_pixels_iterated >= median_pixel_index)
        median_value = tmp_pixel_value
    }

    return (this.cached_stats[level_min + '-' + level_max] = {
      levels: {
        mean: mean_value,
        median: median_value,
        std_dev: Math.sqrt(tmp_sum_of_deviations / pixels_total),
        unique: unique_values
      },
      pixels_per_level: {
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
  level_min =
    typeof level_min === 'number'
      ? utils.clamp(Math.round(level_min), 0, COLOR_RANGE_END)
      : 0

  level_max =
    typeof level_max === 'number'
      ? utils.clamp(Math.round(level_max), 0, COLOR_RANGE_END)
      : COLOR_RANGE_END

  if (level_min > level_max) {
    throw new Error(`Invalid range "${level_min}...${level_max}"`)
  }

  return [level_min, level_max]
}

export default Histogram
