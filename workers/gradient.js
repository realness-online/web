// this code is inspired by https://github.com/ben-eb/postcss-resemble-image
// for Number.EPSILON edge case see https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
import Jimp from 'jimp'
import { setup_jimp } from '@/workers/image'
import { rgba_to_hsla } from '@/use/colors'
export const as_gradient = (image, height = false) => {
  let direction = image.bitmap.width
  let opposite = image.bitmap.height
  if (height) {
    direction = image.bitmap.height
    opposite = image.bitmap.width
  }
  const chunk = fidelity(direction)
  const stops = []
  for (let i = 0; i < direction; i += chunk) {
    let color = image
      .clone()
      .crop(i, 0, chunk, opposite)
      .resize(1, 1, Jimp.default.RESIZE_BICUBIC)
      .getPixelColor(0, 0)

    color = Jimp.default.intToRGBA(color)
    color = rgba_to_hsla(color)
    stops.push({ color, offset: scale(i, 0, direction) })
  }
  return stops
}
export const as_radial_gradient = image => {
  let box_size = image.bitmap.width
  if (image.bitmap.height < box_size) box_size = image.bitmap.height
  const chunk = fidelity(box_size)
  const stops = []
  for (let i = 0; i < box_size; i += chunk) {
    let color = image
      .clone()
      .crop(i, 0, chunk, box_size)
      .resize(1, 1, Jimp.default.RESIZE_BICUBIC)
      .getPixelColor(0, 0)
    color = Jimp.default.intToRGBA(color)
    color = rgba_to_hsla(color)
    stops.push({ color, offset: scale(i, 0, box_size) })
  }
  return stops
}
export const fidelity = (length, pair = { number: 15, unit: '%' }) => {
  if (!pair) throw new Error('Expects <number> or <percentage> for fidelity')
  const number = parseFloat(pair.number)
  if (number === 0) throw new Error('Expected a fidelity greater than 0.')
  if (pair.unit === '%') return length * (number / 100)
  return number
}
export const scale = (value, min, max) => {
  const new_min = 0
  const new_max = 100
  const percent = (value - min) / (max - min)
  const scale = percent * (new_max - new_min) + new_min
  return Math.round((scale + Number.EPSILON) * 100) / 100
}
export const is_stop = stop => {
  if (!stop.percentage) return false
  if (!stop.color) return false
  return true
}
export const listen = async message => {
  console.time('make:gradient')
  setup_jimp()
  let image = Jimp.read(message.data.bitmap)
  const horizontal = as_gradient(image)
  const vertical = as_gradient(image, true)
  const radial = as_radial_gradient(image)
  const gradients = { horizontal, vertical, radial }
  self.postMessage({ gradients })
  console.timeEnd('make:gradient')
}
self.addEventListener('message', listen)
