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

  // Private fields need to be declared first
  #sorted_indexes = null
  #cached_stats = {}
  #lookup_table_h = null
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
  #get_sorted_indexes(refresh) {
    if (!refresh && this.#sorted_indexes) {
      return this.#sorted_indexes
    }

    const data = this.data
    const indexes = new Array(COLOR_DEPTH)

    for (let i = 0; i < COLOR_DEPTH; i++) {
      indexes[i] = i
    }

    indexes.sort((a, b) => (data[a] > data[b] ? 1 : data[a] < data[b] ? -1 : 0))

    this.#sorted_indexes = indexes
    return indexes
  }

  /**
   * Builds lookup table H from lookup tables P and S
   * See {@link http://www.iis.sinica.edu.tw/page/jise/2001/200109_01.pdf|this paper} for more details
   * @returns {Float64Array} Lookup table H
   * @private
   */
  #thresholding_build_lookup_table() {
    const p = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    const s = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    const h = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    const pixels_total = this.pixels
    let i, j, idx, tmp

    // diagonal
    for (i = 1; i < COLOR_DEPTH; ++i) {
      idx = index(i, i)
      tmp = this.data[i] / pixels_total

      p[idx] = tmp
      s[idx] = i * tmp
    }

    // calculate first row (row 0 is all zero)
    for (i = 1; i < COLOR_DEPTH - 1; ++i) {
      tmp = this.data[i + 1] / pixels_total
      idx = index(1, i)

      p[idx + 1] = p[idx] + tmp
      s[idx + 1] = s[idx] + (i + 1) * tmp
    }

    // using row 1 to calculate others
    for (i = 2; i < COLOR_DEPTH; i++) {
      for (j = i + 1; j < COLOR_DEPTH; j++) {
        p[index(i, j)] = p[index(1, j)] - p[index(1, i - 1)]
        s[index(i, j)] = s[index(1, j)] - s[index(1, i - 1)]
      }
    }

    // now calculate h[i][j]
    for (i = 1; i < COLOR_DEPTH; ++i) {
      for (j = i + 1; j < COLOR_DEPTH; j++) {
        idx = index(i, j)
        h[idx] = p[idx] !== 0 ? (s[idx] * s[idx]) / p[idx] : 0
      }
    }

    return (this.#lookup_table_h = h)
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
  multilevelThresholding(amount, level_min, level_max) {
    ;[level_min, level_max] = normalize_min_max(level_min, level_max)
    amount = Math.min(level_max - level_min - 2, ~~amount)

    if (amount < 1) {
      return []
    }

    if (!this.#lookup_table_h) {
      this.#thresholding_build_lookup_table()
    }

    if (amount > 4) {
      console.log(
        '[Warning]: Threshold computation for more than 5 levels may take a long time'
      )
    }

    const [color_stops] = iterate_recursive(
      level_min || 0,
      0,
      null,
      0,
      this.#lookup_table_h,
      amount,
      level_max
    )

    return color_stops || []
  }

  /**
   * Automatically finds threshold value using Algorithm For Multilevel Thresholding
   *
   * @param {number} [levelMin]
   * @param {number} [levelMax]
   * @returns {null|number}
   */
  autoThreshold(levelMin, levelMax) {
    var value = this.multilevelThresholding(1, levelMin, levelMax)
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
  getDominantColor(levelMin, levelMax, tolerance) {
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
  getStats(levelMin, levelMax, refresh) {
    levelMin = normalize_min_max(levelMin, levelMax)
    levelMax = levelMin[1]
    levelMin = levelMin[0]

    if (!refresh && this.#cached_stats[levelMin + '-' + levelMax]) {
      return this.#cached_stats[levelMin + '-' + levelMax]
    }

    var data = this.data
    var sortedIndexes = this.#get_sorted_indexes()

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

    return (this.#cached_stats[levelMin + '-' + levelMax] = {
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
 * Shared parameter normalization for methods 'multilevelThresholding', 'autoThreshold', 'getDominantColor' and 'getStats'
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

/**
 * Recursive function for multilevel thresholding
 * @param {number} starting_point - Starting point for iteration
 * @param {number} prev_variance - Previous variance value
 * @param {Array} indexes - Array to store threshold indexes
 * @param {number} previous_depth - Previous depth in recursion
 * @param {Float64Array} h - Lookup table H
 * @param {number} amount - Number of thresholds
 * @param {number} level_max - Maximum level
 * @returns {[Array, number]} - Array of color stops and maximum significance
 * @private
 */
const iterate_recursive = (
  starting_point,
  prev_variance,
  indexes,
  previous_depth,
  h,
  amount,
  level_max
) => {
  starting_point = (starting_point || 0) + 1
  prev_variance = prev_variance || 0
  indexes = indexes || new Array(amount)
  previous_depth = previous_depth || 0

  const depth = previous_depth + 1
  let max_sig = 0
  let color_stops = null

  for (let i = starting_point; i < level_max - amount + previous_depth; i++) {
    const variance = prev_variance + h[index(starting_point, i)]
    indexes[depth - 1] = i

    if (depth + 1 < amount + 1) {
      // we need to go deeper
      const [new_stops, new_sig] = iterate_recursive(
        i,
        variance,
        indexes,
        depth,
        h,
        amount,
        level_max
      )
      if (new_sig > max_sig) {
        max_sig = new_sig
        color_stops = new_stops
      }
    } else {
      // enough, we can compare values now
      const total_variance = variance + h[index(i + 1, level_max)]

      if (max_sig < total_variance) {
        max_sig = total_variance
        color_stops = indexes.slice()
      }
    }
  }

  return [color_stops, max_sig]
}

export default Histogram
