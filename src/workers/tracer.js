import { initSync, Tracer, TraceOptions } from '@/wasm/tracer.js'
import { size } from '@/utils/image.js'

let tracer
let initialized = false

const init_tracer = async () => {
  const response = await fetch('/wasm/tracer_bg.wasm')
  const wasm_bytes = await response.arrayBuffer()
  initSync({ module: wasm_bytes })

  const options = new TraceOptions()
  options.color_count = 32
  options.min_color_count = 16
  options.max_color_count = 32
  options.turd_size = 10
  options.corner_threshold = 60
  options.color_precision = 8
  options.path_precision = 8
  options.force_color_count = true
  options.hierarchical = 1
  options.keep_details = true
  options.diagonal = false
  options.batch_size = 25600
  options.good_min_area = 16
  options.good_max_area = 512 * 1024
  options.is_same_color_a = 8
  options.is_same_color_b = 2
  options.deepen_diff = 32
  options.hollow_neighbours = 1

  tracer = new Tracer(options)
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

  // Create canvas with original dimensions
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Verify image data is valid
  if (image_data.data.length !== image_data.width * image_data.height * 4) {
    throw new Error(
      `Invalid image data size: ${image_data.data.length} != ${image_data.width * image_data.height * 4}`
    )
  }

  // Scale good_min_area with image size but cap it
  const area = image_data.width * image_data.height
  tracer.options.good_min_area = Math.min(Math.floor(area * 0.0001), 100)
  tracer.options.good_max_area = Math.min(area, 1024 * 1024) // Cap at 1M pixels

  console.log('Adjusted tracer options:', {
    batch_size: tracer.options.batch_size,
    good_min_area: tracer.options.good_min_area,
    good_max_area: tracer.options.good_max_area
  })

  // Initialize the tracer with the image
  tracer.init(image_data)

  // Start the processing loop
  const process = () => {
    try {
      const done = tracer.tick()
      const progress = tracer.progress()

      // Send progress update
      self.postMessage({
        type: 'progress',
        progress
      })

      if (!done) {
        // Schedule next tick
        setTimeout(process, 1)
      } else {
        // Send completion message
        self.postMessage({
          type: 'complete',
          width: image_data.width,
          height: image_data.height
        })
      }
    } catch (error) {
      console.error('Error in processing loop:', error)
      self.postMessage({
        type: 'error',
        error: error.message
      })
    }
  }

  // Start processing
  process()
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
