import { Jimp, as_paths } from '@realness.online/potrace'
const jimp_options = {
  threshold: 255,
  turdSize: 125,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'median',
  rangeDistribution: 'auto'
}
const brighness_options = {
  max: 200,
  replace: 255,
  autoGreyscale: false
}
export async function read (file) {
  const reader = new FileReaderSync()
  return await Jimp.read(reader.readAsArrayBuffer(file))
}
export async function prepare (image, size = 512) {
  if (image.bitmap.width > image.bitmap.height) image = image.resize(Jimp.AUTO, size)
  else image = image.resize(size, Jimp.AUTO)
  return image.normalize().threshold(brighness_options)
}
export async function make (image) {
  const poster = await as_paths(image, jimp_options)
  return {
    created_at: Date.now(),
    path: poster.paths,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export async function listen (message) {
  let image = await read(message.data.image)
  image = await prepare(image)
  const vector = await make(image)
  self.postMessage(vector)
}
self.addEventListener('message', listen)
