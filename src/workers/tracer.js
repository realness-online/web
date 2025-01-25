import init, { process_image } from '@/artifacts/wasm/tracer'

export const tracer_options = {
  // Color quantization options
  color_count: 4,
  min_color_count: 2,
  max_color_count: 8,

  // Shape detection options
  turd_size: 40, // minimum size of shapes to keep
  corner_threshold: 60, // angle threshold for corners (degrees)

  // Curve fitting options
  splice_threshold: 45, // max angle for curve splicing
  filter_speckle: 4, // remove speckles of this size

  // Color clustering
  color_precision: 6, // color precision bits per channel
  path_precision: 8, // decimal places in path data

  // Additional options
  hierarchical: true, // generate hierarchical SVG
  keep_details: true // preserve small details
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
export const read = file => {
  const array_buffer = new FileReaderSync().readAsArrayBuffer(file)
  const blob = new Blob([array_buffer])
  return createImageBitmap(blob)
}

/**
 * @param {MessageEvent} message
 * @returns {Promise<Object>}
 */
export const make_trace = async message => {
  console.time('make:trace')

  // Initialize WASM module
  await init()

  const image = await read(message.data.image)
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(image, 0, 0)
  const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Call our Rust/WASM function
  const trace = await process_image(image_data, tracer_options)

  console.timeEnd('make:trace')
  return { trace }
}

export const route_message = async message => {
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

self.addEventListener('message', async event => {
  const reply = await route_message(event)
  self.postMessage(reply)
})
