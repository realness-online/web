import { initSync, process_image, TraceOptions } from '@/wasm/tracer.js'
import { size } from '@/utils/image.js'

let tracer_options
let initialized = false

const init_tracer = async () => {
  const response = await fetch('/wasm/tracer_bg.wasm')
  const wasm_bytes = await response.arrayBuffer()
  initSync({ module: wasm_bytes })

  tracer_options = new TraceOptions()
  tracer_options.color_count = 32
  tracer_options.min_color_count = 16
  tracer_options.max_color_count = 32
  tracer_options.turd_size = 10
  tracer_options.corner_threshold = 60
  tracer_options.color_precision = 8
  tracer_options.path_precision = 8
  tracer_options.force_color_count = true
  tracer_options.hierarchical = 1
  tracer_options.keep_details = true
  tracer_options.diagonal = false
  tracer_options.batch_size = 512
  tracer_options.good_min_area = 16
  tracer_options.good_max_area = 512 * 1024
  tracer_options.is_same_color_a = 8
  tracer_options.is_same_color_b = 2
  tracer_options.deepen_diff = 32
  tracer_options.hollow_neighbours = 1

  initialized = true
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
const read = file => {
  const array_buffer = new FileReaderSync().readAsArrayBuffer(file)
  const blob = new Blob([array_buffer])
  return createImageBitmap(blob)
}

const make_trace = async message => {
  const image = await read(message.data.image)
  console.log('Image loaded:', image.width, 'x', image.height)

  const canvas = size(image)
  const ctx = canvas.getContext('2d')
  const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  console.log(
    'Image data:',
    image_data.width,
    'x',
    image_data.height,
    'bytes:',
    image_data.data.length,
    'first few pixels:',
    Array.from(image_data.data.slice(0, 16))
  )

  // Verify image data is valid
  if (image_data.data.length !== image_data.width * image_data.height * 4) {
    throw new Error(
      `Invalid image data size: ${image_data.data.length} != ${image_data.width * image_data.height * 4}`
    )
  }

  // Adjust tracer options based on image dimensions
  const short_side = Math.min(image_data.width, image_data.height)
  const area = image_data.width * image_data.height

  // Scale batch size with image dimensions
  tracer_options.batch_size = short_side

  // Scale good_min_area with image size
  tracer_options.good_min_area = Math.floor(area * 0.0001)

  // Scale good_max_area with image size
  tracer_options.good_max_area = area

  console.log('Adjusted tracer options:', {
    batch_size: tracer_options.batch_size,
    good_min_area: tracer_options.good_min_area,
    good_max_area: tracer_options.good_max_area,
    is_same_color_a: tracer_options.is_same_color_a,
    is_same_color_b: tracer_options.is_same_color_b,
    deepen_diff: tracer_options.deepen_diff
  })

  const trace = await process_image(image_data, tracer_options)
  console.log('Trace complete:', trace)
  return { trace }
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

// Initialize on worker start
let init_promise = init_tracer().catch(error => {
  console.error('Failed to initialize tracer:', error)
  self.postMessage({ error: 'Failed to initialize tracer' })
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
