import potrace from 'javascript-potrace'
import Jimp from 'jimp'
import EXIF from 'exif-js'
const options = { threshold: 133, turdSize: 22 }
const convert_to_vector = {
  async make_avatar(file, identifier) {
    let image = await this.read_image(file)
    image = image.resize(333, Jimp.AUTO)
    return this.trace_as_symbol(this.prepare(image), identifier)
  },
  async make_poster(file) {
    let image = await this.read_image(file)
    return this.trace(this.prepare(image.resize(512, Jimp.AUTO)))
  },
  async read_image(file) {
    const reader = new FileReaderSync()
    let image = await Jimp.read(reader.readAsArrayBuffer(file))
    if (this.is_wrong_orientation(file)) image = image.rotate(-90)
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
      return trace.getSVG()
    })
  }
}
function message_listener(message) {
  switch (message.data.cmd) {
    case 'make_avatar':
      convert_to_vector
      .make_avatar(message.data.image, message.data.id)
      .then(vector => self.postMessage({ vector: vector }))
    case 'make_poster':
      convert_to_vector
      .make_poster(message.data.image)
      .then(vector => {
        console.log('made a vecror', vector)
        self.postMessage({ vector: vector })
      })
  }
}
self.addEventListener('message', message_listener)
// onmessage = (message) => {}
export default convert_to_vector
