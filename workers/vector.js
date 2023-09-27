import Jimp from 'jimp'
import { as_paths } from '@realness.online/potrace'
import ExifReader from 'exifreader'
const potrace_options = {
  turdSize: 40,
  optTolerance: 0.55,
  blackOnWhite: true,
  fillStrategy: 'dominant',
  rangeDistribution: 'auto',
  steps: 3
  // threshold: 255
}
function to_kb(vector) {
  let size_of = 0
  vector.paths.forEach(path => {
    size_of += path.d.length
  })
  return (size_of / 1024).toFixed(2)
}
export async function read(file) {
  const reader = new FileReaderSync()
  return await Jimp.default.read(reader.readAsArrayBuffer(file))
}
export function read_exif(file) {
  const reader = new FileReaderSync()
  return reader.readAsArrayBuffer(file)
}
export async function size(image, size = 512) {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}
export async function make(image) {
  let poster = await as_paths(image, potrace_options)
  if (to_kb(poster) > 600) {
    console.info('poster is too large, resizing')
    image = await size(image, 400) //from 512 to 400
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
  console.time('make:vector')
  let image = await read(message.data.image)
  const tags = ExifReader.load(read_exif(message.data.image))
  console.log('exif', JSON.stringify(tags))
  image = await size(image)
  const vector = await make(image)
  self.postMessage({ reply: 'vectorized', vector })
  console.timeEnd('make:vector')
}
self.addEventListener('message', listen)
