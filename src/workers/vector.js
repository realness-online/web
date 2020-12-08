import { Jimp, as_paths } from '@realness.online/potrace'
const jimp_options = {
  // steps: 3,
  // threshold: 80,
  turdSize: 600,
  optTolerance: 0.2,
  blackOnWhite: true,
  fillStrategy: 'dominant',
  rangeDistribution: 'auto'
}
const brighness_options = {
  max: 255,
  replace: 255,
  autoGreyscale: false
}
export async function read_image (file) {
  const reader = new FileReaderSync()
  return await Jimp.read(reader.readAsArrayBuffer(file))
}
export async function prepare (image, size) {
  if (image.bitmap.width > image.bitmap.height) image = image.resize(Jimp.AUTO, size)
  else image = image.resize(size, Jimp.AUTO)
  return image.normalize().threshold(brighness_options)
}
export async function make_paths (image) {
  const poster = await as_paths(image, jimp_options)
  return {
    created_at: Date.now(),
    path: poster.paths,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export async function listener (message) {
  let image = await read_image(message.data.image)
  image = await prepare(image, 333)
  const vector = await make_paths(image)
  self.postMessage(vector)
}
self.addEventListener('message', listener)
