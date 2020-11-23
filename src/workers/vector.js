import { Jimp, as_paths } from '@realness.online/potrace'
import SVGO from 'svgo'
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
  await make_paths(image)
}

export async function make_paths (image) {
  const poster = await as_paths(image, {
    // steps: 3,
    // threshold: 80,
    turdSize: 600,
    optTolerance: 0.2,
    blackOnWhite: true,
    fillStrategy: 'dominant',
    rangeDistribution: 'auto'
  })
  const viewbox = `0 0 ${poster.width} ${poster.height}`
  const created_at = Date.now()
  const svgo = new SVGO(svgo_options)
  console.log(poster.paths)
  // console.log('first')
  // self.postMessage({ path: poster.paths, viewbox, created_at })
  const shrunk = []
  await Promise.all(poster.paths.map(async (path) => {
    const smaller = await svgo.optimize(path)
    shrunk.push(smaller.data)
  }))
  self.postMessage({ path: shrunk, viewbox, created_at })
  console.log('second', shrunk)
}
export async function read_image (file) {
  const reader = new FileReaderSync()
  const image = await Jimp.read(reader.readAsArrayBuffer(file))
  return image
}
export async function prepare (image) {
  return image.normalize().threshold({
    max: 200,
    replace: 200,
    autoGreyscale: false
  })
}
export function message_listener (message) {
  trace(message.data.image, message.data.width, message.data.turd_size)
}
self.addEventListener('message', message_listener)
