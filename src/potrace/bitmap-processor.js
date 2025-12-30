/**
 * Bitmap preprocessing for Potrace algorithm
 * Handles conversion from ImageData to binary bitmap
 */
import Bitmap from '@/potrace/types/Bitmap'
import Histogram from '@/potrace/types/Histogram'
import utils from '@/potrace/utils'

// Constants
const RGB_MAX = 255
const RGBA_COMPONENTS = 4
const ALPHA_TRANSPARENCY_THRESHOLD = 128

/**
 * Converts ImageData to luminance bitmap
 * @param {ImageData} image_data - Canvas ImageData object
 * @returns {Bitmap} Grayscale bitmap with histogram attached
 */
export const image_data_to_luminance = image_data => {
  const pixels = image_data.data
  const bitmap = new Bitmap(image_data.width, image_data.height)

  for (let i = 0; i < pixels.length; i += RGBA_COMPONENTS) {
    const opacity = pixels[i + 3] / RGB_MAX
    const r = RGB_MAX + (pixels[i + 0] - RGB_MAX) * opacity
    const g = RGB_MAX + (pixels[i + 1] - RGB_MAX) * opacity
    const b = RGB_MAX + (pixels[i + 2] - RGB_MAX) * opacity

    bitmap.data[i / RGBA_COMPONENTS] = utils.luminance(r, g, b)
  }

  // Attach histogram for threshold calculation
  const histogram = new Histogram(bitmap)
  bitmap.set_histogram(histogram)

  return bitmap
}

/**
 * Calculates threshold value for bitmap
 * @param {Bitmap} bitmap - Luminance bitmap with histogram
 * @param {number|'auto'} threshold_option - Threshold value or 'auto'
 * @returns {number} Threshold value (0-255)
 */
export const calculate_threshold = (bitmap, threshold_option) => {
  if (threshold_option === 'auto' || threshold_option === -1) 
    return bitmap.histogram().auto_threshold() || ALPHA_TRANSPARENCY_THRESHOLD
  
  return threshold_option
}

/**
 * Applies threshold to create binary bitmap
 * @param {Bitmap} luminance_bitmap - Grayscale bitmap
 * @param {number} threshold - Threshold value (0-255)
 * @param {boolean} black_on_white - If true, pixels above threshold are white (0)
 * @returns {Bitmap} Binary bitmap (0 = white, 1 = black)
 */
export const apply_threshold = (luminance_bitmap, threshold, black_on_white) => luminance_bitmap.copy(lum => {
    const past_the_threshold = black_on_white ? lum > threshold : lum < threshold
    return past_the_threshold ? 0 : 1
  })

/**
 * Complete preprocessing pipeline: ImageData → binary bitmap
 * @param {ImageData} image_data - Canvas ImageData object
 * @param {Object} options - Processing options
 * @param {number|'auto'} options.threshold - Threshold value or 'auto'
 * @param {boolean} options.black_on_white - Trace dark on light or vice versa
 * @returns {{luminance: Bitmap, binary: Bitmap, threshold: number}} Processing results
 */
export const preprocess_image = (image_data, options) => {
  const { threshold: threshold_option, black_on_white } = options

  const luminance = image_data_to_luminance(image_data)
  const threshold = calculate_threshold(luminance, threshold_option)
  const binary = apply_threshold(luminance, threshold, black_on_white)

  return { luminance, binary, threshold }
}

