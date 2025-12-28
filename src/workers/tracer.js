import {
  initSync,
  ColorImageConverter,
  init_panic_hook
} from '@/wasm/tracer.js'

let converter
let _initialized = false
let is_processing = false

const DEGREES_IN_CIRCLE = 180
const CORNER_DEG = 30
const SPLICE_DEG = 5
const CHUNK_ITER = 10

const deg2rad = deg => (deg / DEGREES_IN_CIRCLE) * Math.PI

const init_tracer = async () => {
  const response = await fetch('/wasm/tracer_bg.wasm')
  const wasm_bytes = await response.arrayBuffer()
  initSync({ module: wasm_bytes })
  init_panic_hook()

  const params = {
    mode: 'polygon',
    hierarchical: 'cutout',
    corner_threshold: deg2rad(CORNER_DEG), // Softer edges - higher threshold allows more rounded corners
    length_threshold: 61,
    max_iterations: 10,
    splice_threshold: deg2rad(SPLICE_DEG), // More path smoothing for softer edges
    filter_speckle: 54,
    color_precision: 0,
    layer_difference: 13,
    path_precision: 3
  }

  converter = ColorImageConverter.new_with_string(JSON.stringify(params))
  _initialized = true
}

const make_trace = message => {
  console.time('make:trace')
  const { image_data } = message.data

  is_processing = false

  if (converter) {
    converter.free()
    converter = null
  }

  const BYTES_PER_PIXEL = 4
  if (
    image_data.data.length !==
    image_data.width * image_data.height * BYTES_PER_PIXEL
  )
    throw new Error(
      `Invalid image data size: ${image_data.data.length} !== ${image_data.width * image_data.height * BYTES_PER_PIXEL}`
    )

  const params = {
    mode: 'polygon',
    hierarchical: 'cutout',
    corner_threshold: deg2rad(CORNER_DEG), // Softer edges - higher threshold allows more rounded corners
    length_threshold: 61,
    max_iterations: 10,
    splice_threshold: deg2rad(SPLICE_DEG), // More path smoothing for softer edges
    filter_speckle: 54,
    color_precision: 0,
    layer_difference: 13,
    path_precision: 3
  }

  converter = ColorImageConverter.new_with_string(JSON.stringify(params))
  converter.init(image_data)

  is_processing = true
  let last_reported_progress = -1
  const process_chunk = () => {
    if (!is_processing) return

    try {
      for (let i = 0; i < CHUNK_ITER && is_processing; i++) {
        const result = converter.tick()
        const progress = converter.progress()

        if (result === 'complete') {
          console.timeEnd('make:trace')
          converter.free()
          converter = null
          self.postMessage({
            type: 'complete',
            width: image_data.width,
            height: image_data.height
          })
          is_processing = false
          return
        } else if (result) {
          const path_data = JSON.parse(result)
          self.postMessage({
            type: 'path',
            path: path_data,
            progress
          })
          last_reported_progress = progress
        }
      }

      const current_progress = converter.progress()
      if (current_progress !== last_reported_progress) {
        self.postMessage({
          type: 'progress',
          progress: current_progress
        })
        last_reported_progress = current_progress
      }

      // If still processing, schedule next chunk
      if (is_processing) setTimeout(process_chunk, 0)
    } catch (error) {
      console.timeEnd('make:trace')
      console.error('Error in processing loop:', error)
      self.postMessage({
        type: 'error',
        error: error.message
      })
      is_processing = false
    }
  }

  process_chunk()
  return {}
}

const route_message = async message => {
  const { route } = message.data
  let reply = {}

  switch (route) {
    case 'make:trace':
      reply = await make_trace(message)
      break
    default:
      console.warn('unknown route', route)
  }
  return reply
}

const init_promise = init_tracer().catch(error => {
  console.error('Failed to initialize converter:', error)
  self.postMessage({ error: 'Failed to initialize converter' })
})

self.addEventListener('message', async event => {
  try {
    await init_promise
    const reply = await route_message(event)
    self.postMessage({ data: reply })
  } catch (error) {
    console.error('Error in message handler:', error)
    self.postMessage({ error: error.message })
  }
})

self.addEventListener('beforeunload', () => {
  if (converter) converter.free()
})
