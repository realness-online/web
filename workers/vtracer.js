import Jimp from 'jimp'
import { as_paths } from '@realness.online/vtracer'
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
export const size = async (image, size = 512) => {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}
export const make = image => {
  console.log('make', image)
  let poster = as_paths(image)
  console.log(`poster size ${to_kb(poster)}kb`)
  return {
    paths: poster.paths
  }
}
export const listen = async message => {
  console.log('listen', message)
  console.time('make:vtracer')
  let image = await read(message.data.image)
  image = await size(image)
  const vector = make(image)
  self.postMessage({ paths: vector.paths })
  console.timeEnd('make:vtracer')
}
self.addEventListener('message', listen)
