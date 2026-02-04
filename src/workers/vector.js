/** @typedef {import('@/potrace/index.js').FillStrategy} FillStrategy */
import { as_paths } from '@/potrace/index.js'
import { rgba_to_hsla } from '@/utils/colors'
import { optimize } from 'svgo/browser'

const RGBA_COMPONENTS = 4
const PERCENTAGE_MAX = 100
const SCALE_PRECISION = 100

export const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: /** @type {FillStrategy} */ ('dominant'),
  rangeDistribution: /** @type {'auto'|'equal'} */ ('auto'),
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
          removeEmptyAttrs: false,
          mergePaths: false,
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

export const get_average_color = (canvas, region) => {
  const { x, y, width, height } = region
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const image_data = ctx.getImageData(x, y, width, height)
  const { data } = image_data

  let r = 0,
    g = 0,
    b = 0,
    a = 0
  const pixel_count = data.length / RGBA_COMPONENTS

  for (let i = 0; i < data.length; i += RGBA_COMPONENTS) {
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
    const color = get_average_color(canvas, {
      x: height ? 0 : i,
      y: height ? i : 0,
      width: height ? opposite : chunk,
      height: height ? chunk : opposite
    })
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
    const color = get_average_color(canvas, {
      x: i,
      y: 0,
      width: chunk,
      height: box_size
    })
    stops.push({
      color: rgba_to_hsla(color),
      offset: scale(i, 0, box_size)
    })
  }

  return stops
}

export const fidelity = (length, pair = { number: 15, unit: '%' }) => {
  if (!pair) throw new Error('Expects <number> or <percentage> for fidelity')
  const number =
    typeof pair.number === 'string' ? parseFloat(pair.number) : pair.number
  if (number === 0) throw new Error('Expected a fidelity greater than 0.')
  if (pair.unit === '%') return length * (number / PERCENTAGE_MAX)
  return number
}
export const scale = (value, min, max) => {
  const new_min = 0
  const new_max = 100
  const percent = (value - min) / (max - min)
  const scale = percent * (new_max - new_min) + new_min
  return (
    Math.round((scale + Number.EPSILON) * SCALE_PRECISION) / SCALE_PRECISION
  )
}
export const is_stop = stop => {
  if (!stop.percentage) return false
  if (!stop.color) return false
  return true
}

export const make_vector = message => {
  const { image_data } = message.data

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

  return { vector }
}

export const make_gradient = message => {
  const { image_data } = message.data

  // Create a temporary canvas to work with the image data
  const canvas = new OffscreenCanvas(image_data.width, image_data.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.putImageData(image_data, 0, 0)

  const gradients = {
    horizontal: as_gradient(canvas),
    vertical: as_gradient(canvas, true),
    radial: as_radial_gradient(canvas)
  }

  return { gradients }
}

export const optimize_vector = message => {
  const optimized = optimize(
    message.data.vector,
    /** @type {any} */ (svgo_options)
  )
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
  const reply = await route_message(event)
  self.postMessage(reply)
})
