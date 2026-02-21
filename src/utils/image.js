import { IMAGE } from '@/utils/numbers'

/**
 * @param {ImageBitmap} image
 * @param {number} [target_size=IMAGE.TARGET_SIZE]
 * @returns {OffscreenCanvas}
 */
export const size = (image, target_size = IMAGE.TARGET_SIZE) => {
  let new_width = image.width
  let new_height = image.height

  if (image.width > image.height) {
    new_height = target_size
    new_width = Math.round((target_size * image.width) / image.height)
  } else {
    new_width = target_size
    new_height = Math.round((target_size * image.height) / image.width)
  }

  const canvas = new OffscreenCanvas(new_width, new_height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to get 2d context')
  ctx.drawImage(image, 0, 0, new_width, new_height)
  return canvas
}
