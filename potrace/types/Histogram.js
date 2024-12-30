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

  // Default property values
  data = null
  pixels = 0
  _sorted_indexes = null
  _cached_stats = {}
  _lookup_table_h = null

  constructor(image_source, mode) {
    if (typeof image_source === 'number') {
      this._create_array(image_source)
    } else if (image_source instanceof Bitmap) {
      this._collect_values_bitmap(image_source)
    } else if (Jimp && image_source instanceof Jimp) {
      this._collect_values_jimp(image_source, mode)
    } else {
      throw new Error('Unsupported image source')
    }
  }

  _create_array(image_size) {
    const ArrayType =
      image_size <= Math.pow(2, 8)
        ? Uint8Array
        : image_size <= Math.pow(2, 16)
          ? Uint16Array
          : Uint32Array

    this.pixels = image_size
    return (this.data = new ArrayType(COLOR_DEPTH))
  }

  /**
   * @param {Jimp} source
   * @param mode
   * @private
   */
  _collect_values_jimp(source, mode) {
    var pixelData = source.bitmap.data
    var data = this._create_array(source.bitmap.width * source.bitmap.height)

    source.scan(
      0,
      0,
      source.bitmap.width,
      source.bitmap.height,
      function (x, y, idx) {
        var val =
          mode === Histogram.MODE_R
            ? pixelData[idx]
            : mode === Histogram.MODE_G
              ? pixelData[idx + 1]
              : mode === Histogram.MODE_B
                ? pixelData[idx + 2]
                : utils.luminance(
                    pixelData[idx],
                    pixelData[idx + 1],
                    pixelData[idx + 2]
                  )

        data[val]++
      }
    )
  }

  /**
   * Aggregates color data from {@link Bitmap} instance
   * @param {Bitmap} source
   * @private
   */
  _collect_values_bitmap(source) {
    var data = this._create_array(source.size)
    var len = source.data.length
    var color

    for (var i = 0; i < len; i++) {
      color = source.data[i]
      data[color]++
    }
  }

  /**
   * Returns array of color indexes in ascending order
   * @param refresh
   * @returns {*}
   * @private
   */
  _get_sorted_indexes(refresh) {
    if (!refresh && this._sorted_indexes) {
      return this._sorted_indexes
    }

    var data = this.data
    var indexes = new Array(COLOR_DEPTH)
    var i = 0

    for (i; i < COLOR_DEPTH; i++) {
      indexes[i] = i
    }

    indexes.sort(function (a, b) {
      return data[a] > data[b] ? 1 : data[a] < data[b] ? -1 : 0
    })

    this._sorted_indexes = indexes
    return indexes
  }

  /**
   * Builds lookup table H from lookup tables P and S.
   * see {@link http://www.iis.sinica.edu.tw/page/jise/2001/200109_01.pdf|this paper} for more details
   *
   * @returns {Float64Array}
   * @private
   */
  _thresholding_build_lookup_table() {
    var P = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    var S = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    var H = new Float64Array(COLOR_DEPTH * COLOR_DEPTH)
    var pixelsTotal = this.pixels
    var i, j, idx, tmp

    // diagonal
    for (i = 1; i < COLOR_DEPTH; ++i) {
      idx = index(i, i)
      tmp = this.data[i] / pixelsTotal

      P[idx] = tmp
      S[idx] = i * tmp
    }

    // calculate first row (row 0 is all zero)
    for (i = 1; i < COLOR_DEPTH - 1; ++i) {
      tmp = this.data[i + 1] / pixelsTotal
      idx = index(1, i)

      P[idx + 1] = P[idx] + tmp
      S[idx + 1] = S[idx] + (i + 1) * tmp
    }

    // using row 1 to calculate others
    for (i = 2; i < COLOR_DEPTH; i++) {
      for (j = i + 1; j < COLOR_DEPTH; j++) {
        P[index(i, j)] = P[index(1, j)] - P[index(1, i - 1)]
        S[index(i, j)] = S[index(1, j)] - S[index(1, i - 1)]
      }
    }

    // now calculate H[i][j]
    for (i = 1; i < COLOR_DEPTH; ++i) {
      for (j = i + 1; j < COLOR_DEPTH; j++) {
        idx = index(i, j)
        H[idx] = P[idx] !== 0 ? (S[idx] * S[idx]) / P[idx] : 0
      }
    }

    return (this._lookup_table_h = H)
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
  multilevelThresholding(amount, levelMin, levelMax) {
    levelMin = normalize_min_max(levelMin, levelMax)
    levelMax = levelMin[1]
    levelMin = levelMin[0]
    amount = Math.min(levelMax - levelMin - 2, ~~amount)

    if (amount < 1) {
      return []
    }

    if (!this._lookup_table_h) {
      this._thresholding_build_lookup_table()
    }

    var H = this._lookup_table_h

    var colorStops = null
    var maxSig = 0

    if (amount > 4) {
      console.log(
        '[Warning]: Threshold computation for more than 5 levels may take a long time'
      )
    }

    function iterateRecursive(
      startingPoint,
      prevVariance,
      indexes,
      previousDepth
    ) {
      startingPoint = (startingPoint || 0) + 1
      prevVariance = prevVariance || 0
      indexes = indexes || new Array(amount)
      previousDepth = previousDepth || 0

      var depth = previousDepth + 1 // t
      var variance

      for (var i = startingPoint; i < levelMax - amount + previousDepth; i++) {
        variance = prevVariance + H[index(startingPoint, i)]
        indexes[depth - 1] = i

        if (depth + 1 < amount + 1) {
          // we need to go deeper
          iterateRecursive(i, variance, indexes, depth)
        } else {
          // enough, we can compare values now
          variance += H[index(i + 1, levelMax)]

          if (maxSig < variance) {
            maxSig = variance
            colorStops = indexes.slice()
          }
        }
      }
    }

    iterateRecursive(levelMin || 0)

    return colorStops ? colorStops : []
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

    if (!refresh && this._cached_stats[levelMin + '-' + levelMax]) {
      return this._cached_stats[levelMin + '-' + levelMax]
    }

    var data = this.data
    var sortedIndexes = this._get_sorted_indexes()

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

    return (this._cached_stats[levelMin + '-' + levelMax] = {
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

const normalize_min_max = (level_min, level_max) => {
  /**
   * Shared parameter normalization for methods 'multilevelThresholding', 'autoThreshold', 'getDominantColor' and 'getStats'
   *
   * @param levelMin
   * @param levelMax
   * @returns {number[]}
   * @private
   */
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
