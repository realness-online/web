import {
  initSync,
  ColorImageConverter,
  init_panic_hook
} from '@/wasm/tracer.js'

let converter
let initialized = false

const deg2rad = deg => (deg / 180) * Math.PI

const init_tracer = async () => {
  const response = await fetch('/wasm/tracer_bg.wasm')
  const wasm_bytes = await response.arrayBuffer()
  initSync({ module: wasm_bytes })
  init_panic_hook()

  const params = {
    mode: 'polygon',
    hierarchical: 'cutout',
    corner_threshold: deg2rad(18),
    length_threshold: 61,
    max_iterations: 10,
    splice_threshold: deg2rad(2),
    filter_speckle: 54,
    color_precision: 0,
    layer_difference: 13,
    path_precision: 3
  }

  converter = ColorImageConverter.new_with_string(JSON.stringify(params))
  initialized = true
}

const make_trace = async message => {
  const { image_data } = message.data

  // Verify image data is valid
  if (image_data.data.length !== image_data.width * image_data.height * 4) 
    throw new Error(
      `Invalid image data size: ${image_data.data.length} != ${image_data.width * image_data.height * 4}`
    )
  
  converter.init(image_data)

  // Start the processing loop
  const process = () => {
    try {
      const result = converter.tick()
      const progress = converter.progress()

      self.postMessage({
        type: 'progress',
        progress
      })

      if (result === 'complete') 
        self.postMessage({
          type: 'complete',
          width: image_data.width,
          height: image_data.height
        })
       else if (result) {
        const path_data = JSON.parse(result)
        self.postMessage({
          type: 'path',
          path: path_data
        })
        // Schedule next tick
        setTimeout(process, 1)
      } else if (progress < 100) 
        setTimeout(process, 3)
       else 
        self.postMessage({
          type: 'complete',
          width: image_data.width,
          height: image_data.height
        })
      
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
  return {} // Return empty object to satisfy type
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
