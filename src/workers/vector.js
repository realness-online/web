import potrace from '@realness.online/potrace'
import SVGO from 'svgo'
const Jimp = potrace.Jimp
const svgo_options = {
  multipass: true,
  full: true,
  plugins: [
    { cleanupAttrs: true },
    { removeEmptyAttrs: true },
    { removeViewBox: false },
    { convertPathData: true },
    { removeUselessStrokeAndFill: true },
    { cleanupNumericValues: true },
    { sortAttrs: false },
    { removeAttrs: { attrs: '(stroke|fill)' } }
  ]
}
const convert_to_vector = {
  async trace (file, size = 333, turd_size = 300) {
    let image = await this.read_image(file)
    if (image.bitmap.width > image.bitmap.height) {
      image = image.resize(Jimp.AUTO, size)
    } else image = image.resize(size, Jimp.AUTO)
    image = await this.prepare(image)
    const trace = new potrace.Potrace()
    trace.setParameters({ turdSize: turd_size })
    trace.loadImage(image, error => {
      if (error) throw error
      const path = trace.getPathTag()
      const width = trace._luminanceData.width
      const height = trace._luminanceData.height
      const viewbox = `0 0 ${width} ${height}`
      const created_at = Date.now()
      const svgo = new SVGO(svgo_options)
      self.postMessage({ path, viewbox, created_at })
      svgo.optimize(path).then(smaller_path => {
        self.postMessage({ path: smaller_path.data, viewbox, created_at })
      })
    })
  },
  async read_image (file) {
    const reader = new FileReaderSync()
    const image = await Jimp.read(reader.readAsArrayBuffer(file))
    return image
  },
  async prepare (image) {
    return image.normalize().threshold({
      max: 200,
      replace: 200
    })
  }
}
function message_listener (message) {
  convert_to_vector.trace(message.data.image,
                          message.data.width,
                          message.data.turd_size)
}
self.addEventListener('message', message_listener)
export default convert_to_vector
