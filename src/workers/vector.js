import potrace from '@realness.online/potrace'
import SVGO from 'svgo'
const Jimp = potrace.Jimp
const svgo_options = {
  multipass: true,
  full: true,
  plugins: [
    { cleanupAttrs: true },
    { removeEmptyAttrs: true },
    { removeViewBox: false },
    { convertPathData: true },
    { removeUselessStrokeAndFill: true },
    { cleanupNumericValues: true },
    { sortAttrs: false },
    { removeAttrs: { attrs: '(stroke|fill)' } }
  ]
}
export async function trace (file, size = 333) {
  let image = await read_image(file)
  if (image.bitmap.width > image.bitmap.height) {
    image = image.resize(Jimp.AUTO, size)
  } else image = image.resize(size, Jimp.AUTO)
  image = await prepare(image)
  await make_background(image)
  await make_foreground(image)
}

export async function make_background (image, turd_size = 300) {
  console.log('make_background')
  const trace = new potrace.Potrace()
  trace.setParameters({ turdSize: turd_size })
  trace.loadImage(image, error => {
    if (error) throw error
    const path = trace.getPathTag()
    const width = trace._luminanceData.width
    const height = trace._luminanceData.height
    const viewbox = `0 0 ${width} ${height}`
    const created_at = Date.now()
    const svgo = new SVGO(svgo_options)
    self.postMessage({ type: 'background', path, viewbox, created_at })
    svgo.optimize(path).then(smaller_path => {
      self.postMessage({
        path: smaller_path.data,
        type: 'background',
        viewbox,
        created_at
      })
    })
  })
}
export async function make_foreground (image) {
  console.log('make_forground')
  const trace = new potrace.Potrace()
  trace.setParameters({
    turdSize: 40,
    threshold: 100
  })
  trace.loadImage(image, error => {
    if (error) throw error
    const path = trace.getPathTag()
    const width = trace._luminanceData.width
    const height = trace._luminanceData.height
    const viewbox = `0 0 ${width} ${height}`
    const created_at = Date.now()
    const svgo = new SVGO(svgo_options)
    self.postMessage({ type: 'foreground', path, viewbox, created_at })
    svgo.optimize(path).then(smaller_path => {
      self.postMessage({
        type: 'foreground',
        path: smaller_path.data,
        viewbox,
        created_at
      })
    })
  })
}
export async function read_image (file) {
  const reader = new FileReaderSync()
  const image = await Jimp.read(reader.readAsArrayBuffer(file))
  return image
}
export async function prepare (image) {
  return image.normalize().threshold({
    max: 200,
    replace: 200
  })
}
export function message_listener (message) {
  trace(message.data.image, message.data.width, message.data.turd_size)
}
self.addEventListener('message', message_listener)
