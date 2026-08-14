/** @typedef {import('@/potrace/index.js').FillStrategy} FillStrategy */
import { as_paths } from '@/potrace/index.js'
import { rgba_to_hsla } from '@/utils/colors'
import { normalize_set } from '@/utils/path-morph'
import { optimize } from 'svgo/browser'

const RGBA_COMPONENTS = 4
const PERCENTAGE_MAX = 100
const SCALE_PRECISION = 100

const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: /** @type {FillStrategy} */ ('dominant'),
  rangeDistribution: /** @type {'auto'|'equal'} */ ('auto'),
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

/**
 * Averaging gamma-encoded bytes is not averaging colour: half black and half
 * white comes back as a middle grey the picture never contained. Squaring on
 * the way in and taking the root on the way out keeps the strip as bright as
 * it looks.
 */
const get_average_color = (image, region) => {
  const { data } = image
  // Strips land on fractional boundaries; whole pixels are what can be read
  const x = Math.floor(region.x)
  const y = Math.floor(region.y)
  const width = Math.max(1, Math.floor(region.width))
  const height = Math.max(1, Math.floor(region.height))

  let r = 0,
    g = 0,
    b = 0,
    a = 0
  // Weighted by alpha, so a transparent pixel contributes no colour rather
  // than contributing black
  let weight = 0
  const pixel_count = width * height

  for (let row = y; row < y + height; row++) {
    const row_start = row * image.width * RGBA_COMPONENTS
    for (let column = x; column < x + width; column++) {
      const i = row_start + column * RGBA_COMPONENTS
      const alpha = data[i + 3]
      r += data[i] * data[i] * alpha
      g += data[i + 1] * data[i + 1] * alpha
      b += data[i + 2] * data[i + 2] * alpha
      a += alpha
      weight += alpha
    }
  }

  if (!weight) return { r: 0, g: 0, b: 0, a: 0 }

  return {
    r: Math.round(Math.sqrt(r / weight)),
    g: Math.round(Math.sqrt(g / weight)),
    b: Math.round(Math.sqrt(b / weight)),
    a: Math.round(a / pixel_count)
  }
}

const as_gradient = (image, height = false) => {
  const direction = height ? image.height : image.width
  const opposite = height ? image.width : image.height
  const chunk = fidelity(direction)
  const stops = []

  for (let i = 0; i < direction; i += chunk) {
    // The last strip would otherwise run past the edge and average in the
    // transparent black a canvas pads with, darkening the final stop
    const reach = Math.min(chunk, direction - i)
    const color = get_average_color(image, {
      x: height ? 0 : i,
      y: height ? i : 0,
      width: height ? opposite : reach,
      height: height ? reach : opposite
    })
    stops.push({
      color: rgba_to_hsla(color),
      // A strip's average belongs at its middle, not at its leading edge
      offset: scale(i + reach / 2, 0, direction)
    })
  }

  return pin_to_edges(stops)
}

/**
 * The first and last strips carry the colour of the edges they cover, so they
 * sit at 0 and 100. Without this a gradient starts and ends part way in and
 * the paint outside those stops is a flat hold.
 *
 * @param {{ color: object, offset: number }[]} stops
 */
const pin_to_edges = stops => {
  if (stops.length < 2) return stops
  stops[0].offset = 0
  stops[stops.length - 1].offset = 100
  return stops
}

const as_radial_gradient = image => {
  let box_size = image.width
  if (image.height < box_size) box_size = image.height

  const chunk = fidelity(box_size)
  const stops = []

  for (let i = 0; i < box_size; i += chunk) {
    const reach = Math.min(chunk, box_size - i)
    const color = get_average_color(image, {
      x: i,
      y: 0,
      width: reach,
      height: box_size
    })
    stops.push({
      color: rgba_to_hsla(color),
      offset: scale(i + reach / 2, 0, box_size)
    })
  }

  return pin_to_edges(stops)
}

const fidelity = (length, pair = { number: 15, unit: '%' }) => {
  if (!pair) throw new Error('Expects <number> or <percentage> for fidelity')
  const number =
    typeof pair.number === 'string' ? parseFloat(pair.number) : pair.number
  if (number === 0) throw new Error('Expected a fidelity greater than 0.')
  if (pair.unit === '%') return length * (number / PERCENTAGE_MAX)
  return number
}
const scale = (value, min, max) => {
  const new_min = 0
  const new_max = 100
  const percent = (value - min) / (max - min)
  const scale = percent * (new_max - new_min) + new_min
  return (
    Math.round((scale + Number.EPSILON) * SCALE_PRECISION) / SCALE_PRECISION
  )
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

  // The pixels arrive with the message, so the three reads work straight off
  // that buffer rather than round-tripping every strip through a canvas
  const gradients = {
    horizontal: as_gradient(image_data),
    vertical: as_gradient(image_data, true),
    radial: as_radial_gradient(image_data)
  }

  return { gradients }
}

const optimize_vector = message => {
  const optimized = optimize(
    message.data.vector,
    /** @type {any} */ (svgo_options)
  )
  return { vector: optimized.data }
}

/**
 * Rebuild a poster's layers so they share a command signature and can morph
 * into each other. Off the main thread because a poster runs to a few hundred
 * contours and the alignment pass is quadratic in segment count.
 */
const normalize_morph = message => {
  const { paths, contours, segments, precision } = message.data
  return { paths: normalize_set(paths, { contours, segments, precision }) }
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
    case 'normalize:morph':
      reply = normalize_morph(message)
      break
    default:
      console.warn('unknown route', route)
  }
  return reply
}
self.addEventListener('message', async event => {
  // Echoed back so a caller sharing this worker can match replies to its own
  // requests instead of taking whichever answer lands first
  const { id } = event.data
  try {
    const reply = await route_message(event)
    self.postMessage({ id, ...reply })
  } catch (error) {
    console.error('Error in message handler:', error)
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error)
    })
  }
})
