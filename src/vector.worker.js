import potrace from 'javascript-potrace'
import Jimp from 'jimp'
import EXIF from 'exif-js'
const options = { threshold: 133, turdSize: 22 }
const convert_to_vector = {
  make_avatar(file, identifier) {
    let image = read_image(file)
    return trace_as_symbol(prepare(image.resize(333, Jimp.AUTO)), identifier)
  },
  make_poster(poster) {
    let image = read_image(file)
    return trace(prepare(image.resize(512, Jimp.AUTO)))
  },
  read_image(file) {
    const reader = new FileReaderSync()
    let image = Jimp.read(reader.readAsArrayBuffer(file))
    if (is_wrong_orientation(file)) image = image.rotate(-90)
    return image
  },
  is_wrong_orientation(image_file) {
    EXIF.getData(image_file, () => {
      if (image_file.exifdata.Orientation === 6) return true
      else return false
    })
  },
  prepare(image) {
    return image.greyscale().normalize().contrast(0.5).brightness(0.2)
  },
  trace_as_symbol(image, identifier) {
    let trace = new potrace.Potrace()
    trace.setParameters(options)
    trace.loadImage(image, error => {
      if (error) return error
      return trace.as_symbol(identifier)
    })
  },
  trace(image) {
    let trace = new potrace.Potrace()
    trace.setParameters(options)
    trace.loadImage(image, error => {
      if (error) return error
      return trace.as_svg(identifier)
    })
  }
}
onmessage = (message) => {
  switch (message.data.cmd) {
    case 'make_avatar':
      convert_to_vector
      .make_avatar(message.data.image_file, message.data.id)
      .then(vector => {
        self.postMessage({ vector: vector })
      })
    case 'make_poster':
      convert_to_vector
      .make_poster(message.data.image_file)
      .then(vector => {
        self.postMessage({ vector: vector })
      })
  }
}
export default convert_to_vector
