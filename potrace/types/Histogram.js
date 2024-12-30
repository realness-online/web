/**
 * Histogram
 *
 * @param Jimp  imageSource - Image to collect pixel data from. Or integer to create empty histogram for image of specific size
 * @param [mode] Used only for Jimp images. {@link Bitmap} currently can only store 256 values per pixel, so it's assumed that it contains values we are looking for
 * @constructor
 * @protected
 */

import utils from '@/potrace/utils'
import Bitmap from '@/potrace/types/Bitmap'
import Jimp from 'jimp'
const COLOR_DEPTH = 256
const COLOR_RANGE_END = COLOR_DEPTH - 1

/**
 * 1D Histogram
 *
 * @param Jimp  imageSource - Image to collect pixel data from. Or integer to create empty histogram for image of specific size
 * @param [mode] Used only for Jimp images. {@link Bitmap} currently can only store 256 values per pixel, so it's assumed that it contains values we are looking for
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
    } else if (Jimp && image_source instanceof Jimp) {
      this.#collect_values_jimp(image_source, mode)
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
   * Collects pixel values from a Jimp image
   * @param {Jimp} source - Source Jimp image
   * @param {string} mode - Color mode to use (r, g, b, or luminance)
   * @private
   */
  #collect_values_jimp(source, mode) {
    const pixel_data = source.bitmap.data
    const data = this.#create_array(source.bitmap.width * source.bitmap.height)

    source.scan(
      0,
      0,
      source.bitmap.width,
      source.bitmap.height,
      (x, y, idx) => {
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
    )
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
    if (!refresh && this.sorted_indexes) {
      return this.sorted_indexes
    }

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

    let best_result = { max_sig: 0, color_stops: null }

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
  auto_threshold(levelMin, levelMax) {
    const value = this.multilevel_thresholding(1, levelMin, levelMax)
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
  get_dominant_color(levelMin, levelMax, tolerance) {
    levelMin = normalize_min_max(levelMin, levelMax)
    levelMax = levelMin[1]
    levelMin = levelMin[0]
    tolerance = tolerance || 1

    var colors = this.data,
      dominantIndex = -1,
      dominantValue = -1,
      i,
      j,
      tmp

    if (levelMin === levelMax) {
      return colors[levelMin] ? levelMin : -1
    }

    for (i = levelMin; i <= levelMax; i++) {
      tmp = 0

      for (j = ~~(tolerance / -2); j < tolerance; j++) {
        tmp += utils.between(i + j, 0, COLOR_RANGE_END) ? colors[i + j] : 0
      }

      var summIsBigger = tmp > dominantValue
      var summEqualButMainColorIsBigger =
        dominantValue === tmp &&
        (dominantIndex < 0 || colors[i] > colors[dominantIndex])

      if (summIsBigger || summEqualButMainColorIsBigger) {
        dominantIndex = i
        dominantValue = tmp
      }
    }

    return dominantValue <= 0 ? -1 : dominantIndex
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
  get_stats(levelMin, levelMax, refresh) {
    levelMin = normalize_min_max(levelMin, levelMax)
    levelMax = levelMin[1]
    levelMin = levelMin[0]

    if (!refresh && this.cached_stats[levelMin + '-' + levelMax]) {
      return this.cached_stats[levelMin + '-' + levelMax]
    }

    var data = this.data
    var sortedIndexes = this.get_sorted_indexes()

    var pixelsTotal = 0
    var medianValue = null
    var meanValue
    var medianPixelIndex
    var pixelsPerLevelMean
    var pixelsPerLevelMedian
    var tmpSumOfDeviations = 0
    var tmpPixelsIterated = 0
    var allPixelValuesCombined = 0
    var i, tmpPixels, tmpPixelValue

    var uniqueValues = 0 // counter for levels that's represented by at least one pixel
    var mostPixelsPerLevel = 0

    // Finding number of pixels and mean

    for (i = levelMin; i <= levelMax; i++) {
      pixelsTotal += data[i]
      allPixelValuesCombined += data[i] * i

      uniqueValues += data[i] === 0 ? 0 : 1

      if (mostPixelsPerLevel < data[i]) {
        mostPixelsPerLevel = data[i]
      }
    }

    meanValue = allPixelValuesCombined / pixelsTotal
    pixelsPerLevelMean = pixelsTotal / (levelMax - levelMin)
    pixelsPerLevelMedian = pixelsTotal / uniqueValues
    medianPixelIndex = Math.floor(pixelsTotal / 2)

    // Finding median and standard deviation

    for (i = 0; i < COLOR_DEPTH; i++) {
      tmpPixelValue = sortedIndexes[i]
      tmpPixels = data[tmpPixelValue]

      if (tmpPixelValue < levelMin || tmpPixelValue > levelMax) {
        continue
      }

      tmpPixelsIterated += tmpPixels
      tmpSumOfDeviations += Math.pow(tmpPixelValue - meanValue, 2) * tmpPixels

      if (medianValue === null && tmpPixelsIterated >= medianPixelIndex) {
        medianValue = tmpPixelValue
      }
    }

    return (this.cached_stats[levelMin + '-' + levelMax] = {
      // various pixel counts for levels (0..255)

      levels: {
        mean: meanValue,
        median: medianValue,
        stdDev: Math.sqrt(tmpSumOfDeviations / pixelsTotal),
        unique: uniqueValues
      },

      // what's visually represented as bars
      pixelsPerLevel: {
        mean: pixelsPerLevelMean,
        median: pixelsPerLevelMedian,
        peak: mostPixelsPerLevel
      },

      pixels: pixelsTotal
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
