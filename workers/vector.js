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
export const read = async file => {
  const reader = new FileReaderSync()
  return Jimp.default.read(reader.readAsArrayBuffer(file))
}
export const read_exif = file => {
  const reader = new FileReaderSync()
  return reader.readAsArrayBuffer(file)
}
export const size = async (image, size = 512) => {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}
export const make = async image => {
  let poster = await as_paths(image, potrace_options)
  return {
    light: poster.paths[0],
    regular: poster.paths[1],
    bold: poster.paths[2],
    width: poster.width,
    height: poster.height,
    viewbox: `0 0 ${poster.width} ${poster.height}`
  }
}
export const listen = async message => {
  console.time('make:vector')
  let image = await read(message.data.image)
  const tags = ExifReader.load(read_exif(message.data.image))
  exif_logger(tags)
  image = await size(image)
  const vector = await make(image)
  self.postMessage({ reply: 'vectorized', vector })
  console.timeEnd('make:vector')
}
self.addEventListener('message', listen)

const exif_logger = tags => {
  // console.log('exif', JSON.stringify(tags))
  const properties = [
    'Image Width',
    'Image Height',
    'FocalLength',
    'Orientation',
    'SubjectArea'
  ]
  for (const p of properties) console.log(p, tags[p]?.description)
}
