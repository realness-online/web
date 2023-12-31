import Jimp from 'jimp'
import ExifReader from 'exifreader'

export const to_kb = paths => {
  let size_of = 0
  paths.forEach(path => {
    size_of += path.d.length
  })
  return (size_of / 1024).toFixed(2)
}
export const read = async file => {
  const reader = new FileReaderSync()
  return await Jimp.default.read(reader.readAsArrayBuffer(file))
}
export const size = (image, size = 512) => {
  if (image.bitmap.width > image.bitmap.height)
    image = image.resize(Jimp.default.AUTO, size)
  else image = image.resize(size, Jimp.default.AUTO)
  return image
}

export function read_exif(file) {
  const reader = new FileReaderSync()
  return reader.readAsArrayBuffer(file)
}

const exif_logger = image => {
  const tags = ExifReader.load(read_exif(image))
  console.log('exif', JSON.stringify(tags))
  const properties = [
    'Image Width',
    'Image Height',
    'FocalLength',
    'Orientation',
    'SubjectArea'
  ]
  for (const p of properties) console.log(p, tags[p]?.description)
}

export const setup_jimp = () => {
  Jimp.appendConstructorOption(
    'bitmap',
    args => args.bitmap,
    (resolve, reject, args) => {
      this.bitmap = args.bitmap
      resolve()
    }
  )
}

export const listen = async message => {
  console.time('make:vector-tracer')
  let image = await read(message.data.image)
  image = await size(image)
  console.log('image', image.bitmap)
  self.postMessage({ bitmap: image.bitmap })
  // exif_logger(image)
  console.timeEnd('vector-tracer')
}
self.addEventListener('message', listen)
