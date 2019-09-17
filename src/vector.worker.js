// Worker.js

self.addEventListener('message', event => {
  self.postMessage(event.data)
}, false)

// const potrace = require('javascript-potrace')
// const Jimp = require('jimp')
// const EXIF = require('exif-js')
// onmessage = (message) => {
//   // console.log(Jimp)
//   // console.log('message')
// }
// importScripts(location.origin + "/manifest.js");
// importScripts(location.origin + "/worker_bundle.js");

// const options = { threshold: 133, turdSize: 22 }
// function is_wrong_orientation(image_file) {
//   EXIF.getData(image_file, () => {
//     if (image_file.exifdata.Orientation === 6) return true
//     else return false
//   })
// }
// function prepare(image) {
//   return image.greyscale().normalize().contrast(0.5).brightness(0.2)
// }
// async function read_image(file) {
//   let reader = new FileReaderSync()
//   let image = await Jimp.read(reader.readAsArrayBuffer(file))
//   if (is_wrong_orientation(avatar)) image = image.rotate(-90)
//   return image
// }
// function trace_as_symbol(image, identifier) {
//   let trace = new potrace.Potrace()
//   trace.setParameters(options)
//   trace.loadImage(image, error => {
//     if (error) return error
//     return trace.get_as_symbol(identifier)
//   })
// }
// function trace(image) {
//   let trace = new potrace.Potrace()
//   trace.setParameters(options)
//   trace.loadImage(image, error => {
//     if (error) return error
//     return trace.get_as_symbol(identifier)
//   })
// }
// export default {
//   async make_avatar(file, identifier) {
//     let image = read_image(file)
//     return trace_as_symbol(prepare(image.resize(333, Jimp.AUTO)), identifier)
//   },
//   async make_poster(poster) {
//     let image = read_image(file)
//     return trace(prepare(image.resize(512, Jimp.AUTO)))
//   }
// }
