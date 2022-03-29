import Jimp from 'jimp'
import { as_paths } from '@realness.online/potrace'
import { as_gradient } from '@/workers/gradient'

const potrace_options = {
  turdSize: 125,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'median',
  rangeDistribution: 'auto',
  steps: 3
  // threshold: 255
}
const bright = {
  max: 175,
  replace: 255,
  autoGreyscale: false
}
function to_kb(vector) {
  let size_of = 0
  vector.paths.forEach(path => {
    size_of += path.length
  })
  return (size_of / 1024).toFixed(2)
}
export async function read(file) {
  const reader = new FileReaderSync()
  return await Jimp.default.read(reader.readAsArrayBuffer(file))
}
export async function size(image, size = 512) {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}
export async function prepare(image) {
  return image
    .normalize()
    .posterize(13)
    .contrast(0.35)
    .color([{ apply: 'shade', params: [3] }])
    .dither565()
    .threshold(bright)
}
export async function make(image) {
  let poster = await as_paths(image, potrace_options)

  if (to_kb(poster) > 600) {
    image = await size(image, 368)
    poster = await as_paths(image, potrace_options)
  }
  return {
    light: poster.paths[0],
    regular: poster.paths[1],
    bold: poster.paths[2],
    width: poster.width,
    height: poster.height,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export async function listen(message) {
  let image = await read(message.data.image)
  const width = as_gradient(image)
  const height = as_gradient(image, true)
  console.log(width, height)
  image = await prepare(image)
  image = await size(image)
  const vector = await make(image)
  self.postMessage({ vector, width, height })
}
self.addEventListener('message', listen)
