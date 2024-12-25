import Jimp from 'jimp'
import { as_paths } from '@/potrace/index.js'
import { rgba_to_hsla } from '@/use/colors'
import { optimize } from 'svgo/dist/svgo.browser.js'
import ExifReader from 'exifreader'
import pako from 'pako'

const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'dominant',
  rangeDistribution: 'auto',
  steps: 4
  // threshold: 255
}
const svgo_options = {
  multipass: true,
  full: true,
  js2svg: {
    indent: 2,
    pretty: true
  },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeUnknownsAndDefaults: false,
          removeViewBox: false,
          removeEmptyAttrs: false,
          mergePaths: true,
          convertPathData: {
            floatPrecision: 0,
            transformPrecision: 0,
            makeArcs: {
              threshold: 0.5, // coefficient of rounding error
              tolerance: 25.0 // percentage of radius
            }
          }
        }
      }
    }
  ]
}
export const to_kb = obj => {
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / 1024).toFixed(2)
}
export const read = async file => {
  const reader = new FileReaderSync()
  return Jimp.default.read(reader.readAsArrayBuffer(file))
}
export const read_exif = file => {
  const reader = new FileReaderSync()
  return reader.readAsArrayBuffer(file)
}
export const exif_logger = tags => {
  const cloned = structuredClone(tags)
  console.log('EXIF: ', `${to_kb(cloned)}kb`)
  return cloned
}

export const size = async (image, size = 512) => {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}

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

export const make_vector = async message => {
  console.time('make:vector')
  let image = await read(message.data.image)
  const tags = ExifReader.load(read_exif(message.data.image))
  const exif = exif_logger(tags)
  image = await size(image)
  let poster = await as_paths(image, potrace_options)
  const vector = {
    light: poster.paths[0],
    regular: poster.paths[1],
    medium: poster.paths[2],
    bold: poster.paths[3],
    width: poster.width,
    height: poster.height,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
  image = await image.bitmap
  console.timeEnd('make:vector')
  return { vector, exif, image }
}

export const make_gradient = async message => {
  console.time('make:gradient')
  let image = await read(message.data.image)
  image = await size(image)
  const horizontal = as_gradient(image)
  const vertical = as_gradient(image, true)
  const radial = as_radial_gradient(image)
  const gradients = { horizontal, vertical, radial }
  console.timeEnd('make:gradient')
  return { gradients }
}

export const optimize_vector = message => {
  console.time('optimize:vector')
  console.log('Optimizer')
  console.log(`  before: ${to_kb(message.data.vector)}kb`)
  const optimized = optimize(message.data.vector, svgo_options)
  console.log(`  after: ${to_kb(optimized.data)}kb`)
  console.timeEnd('optimize:vector')
  return { vector: optimized.data }
}

const compress_vector = message => {
  console.time('compress:vector')
  console.log('Compressor')
  console.log(`  before: ${to_kb(message.data.vector)}kb`)

  // Convert SVG string to Uint8Array
  const uint8_array = new TextEncoder().encode(message.data.vector)

  // Compress the data using GZIP
  const result = pako.gzip(uint8_array, {
    level: 9, // Maximum compression
    header: {
      name: message.data.filename
    }
  })

  const blob = new Blob([result], { type: 'application/gzip' })
  console.log(`  after: ${(blob.size / 1024).toFixed(2)}kb`)
  console.timeEnd('compress:vector')
  return result
}
export const route_message = async message => {
  const route = message.data.route
  let reply = {}
  switch (route) {
    case 'make:vector':
      reply = await make_vector(message)
      break
    case 'make:gradient':
      reply = await make_gradient(message)
      break
    case 'optimize:vector':
      reply = optimize_vector(message)
      break
    case 'compress:vector':
      reply = compress_vector(message)
      break
    default:
      console.log('unknown route', route)
  }
  self.postMessage(reply)
}
self.addEventListener('message', route_message)
