import { as_paths } from '@realness.online/potrace'
import Jimp from 'jimp'
const potrace_options = {
  threshold: 255,
  turdSize: 125,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'median',
  rangeDistribution: 'auto'
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
  return await Jimp.read(reader.readAsArrayBuffer(file))
}
export async function size(image, size = 512) {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.AUTO, size)
  else image = image.resize(size, Jimp.AUTO)
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
  if (poster.paths[0] === '') poster.paths.shift()
  while (poster.paths.length > 3) poster.paths.shift()
  return {
    path: poster.paths,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export async function listen(message) {
  let image = await read(message.data.image)
  image = await prepare(image)
  image = await size(image)
  const vector = await make(image)
  self.postMessage({ vector: vector })
}
self.addEventListener('message', listen)
