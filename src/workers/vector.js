import { as_paths } from '@/potrace/index.js'
import { rgba_to_hsla } from '@/utils/colors'
import { to_kb } from '@/utils/number'
import { optimize } from 'svgo/dist/svgo.browser.js'

export const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'dominant',
  rangeDistribution: 'auto',
  steps: 4
  // threshold: 255
}
export const svgo_options = {
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

export const read = async file => {
  const array_buffer = new FileReaderSync().readAsArrayBuffer(file)
  const blob = new Blob([array_buffer])
  return createImageBitmap(blob)
}

export const size = (image, target_size = 512) => {
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
  ctx.drawImage(image, 0, 0, new_width, new_height)

  return canvas
}

export const get_average_color = (canvas, x, y, width, height) => {
  const ctx = canvas.getContext('2d')
  const image_data = ctx.getImageData(x, y, width, height)
  const { data } = image_data

  let r = 0,
    g = 0,
    b = 0,
    a = 0
  const pixel_count = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    a += data[i + 3]
  }

  return {
    r: Math.round(r / pixel_count),
    g: Math.round(g / pixel_count),
    b: Math.round(b / pixel_count),
    a: Math.round(a / pixel_count)
  }
}

export const as_gradient = (canvas, height = false) => {
  const direction = height ? canvas.height : canvas.width
  const opposite = height ? canvas.width : canvas.height
  const chunk = fidelity(direction)
  const stops = []

  for (let i = 0; i < direction; i += chunk) {
    const color = get_average_color(
      canvas,
      height ? 0 : i,
      height ? i : 0,
      height ? opposite : chunk,
      height ? chunk : opposite
    )
    stops.push({
      color: rgba_to_hsla(color),
      offset: scale(i, 0, direction)
    })
  }

  return stops
}

export const as_radial_gradient = canvas => {
  let box_size = canvas.width
  if (canvas.height < box_size) box_size = canvas.height

  const chunk = fidelity(box_size)
  const stops = []

  for (let i = 0; i < box_size; i += chunk) {
    const color = get_average_color(canvas, i, 0, chunk, box_size)
    stops.push({
      color: rgba_to_hsla(color),
      offset: scale(i, 0, box_size)
    })
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
  const image = await read(message.data.image)

  const canvas = size(image)
  const ctx = canvas.getContext('2d')
  const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const poster = as_paths(image_data, potrace_options)

  const vector = {
    light: poster.paths[0],
    regular: poster.paths[1],
    medium: poster.paths[2],
    bold: poster.paths[3],
    width: poster.width,
    height: poster.height,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }

  console.timeEnd('make:vector')
  return { vector }
}

export const make_gradient = async message => {
  console.time('make:gradient')
  const image = await read(message.data.image)

  const canvas = size(image)
  const gradients = {
    horizontal: as_gradient(canvas),
    vertical: as_gradient(canvas, true),
    radial: as_radial_gradient(canvas)
  }

  console.timeEnd('make:gradient')
  return { gradients }
}

export const optimize_vector = message => {
  console.time('optimize:vector')
  console.info('Optimizer')
  console.info(`  before: ${to_kb(message.data.vector)}kb`)
  const optimized = optimize(message.data.vector, svgo_options)
  console.info(`  after: ${to_kb(optimized.data)}kb`)
  console.timeEnd('optimize:vector')
  return { vector: optimized.data }
}

export const route_message = async message => {
  const { route } = message.data
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
    default:
      console.warn('unknown route', route)
  }
  return reply
}
self.addEventListener('message', async event => {
  console.log('message', event)
  const reply = await route_message(event)
  self.postMessage(reply)
})
