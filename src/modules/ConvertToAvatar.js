const potrace = require('potrace')
const Jimp = require('jimp')
const EXIF = require('exif-js')
/* istanbul ignore next */
function trace(avatar, identifier) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    let trace = new potrace.Potrace()
    trace.setParameters({ threshold: 95, turdSize: 12 })
    let reader = new FileReader()
    reader.readAsArrayBuffer(avatar)
    reader.onload = function() {
      console.log('buffered')
      let buffer = this.result
      Jimp.read(buffer).then(image => {
        EXIF.getData(avatar, () => {
          image = image.resize(200, Jimp.AUTO)
          if (avatar.exifdata.Orientation === 6) {
            console.log('rotate')
            image = image.rotate(-90)
          }
          trace.loadImage(image, error => {
            console.log('loadImage')
            if (error) { reject(error) }
            resolve(trace.getSymbol(identifier))
          })
        })
      })
    }
  })
}
// const phone_is = {
//   portate: 6
// }
// function orient(avatar) {
//   EXIF.getData(avatar, () => {
//     let orientation = avatar.exifdata.Orientation
//     console.log(orientation, phone_is, avatar.exifdata)
//     return orientation
//   })
// }
// function resize(image) {}
// function posterize(poster) {
//   return new Promise((resolve, reject) => {
//     console.log('posterize...')
//     var posterizer = new potrace.Posterize()
//     posterizer.loadImage(poster, function(error) {
//       if (error) { reject(error) }
//       posterizer.setParameter({
//         steps: 2,
//         threshold: 200
//       })
//       resolve(posterizer.getSymbol('poster'))
//     })
//   })
// }
// function bannerize(banner) {}
export default {
  trace
  // orient,
  // resize,
  // posterize,
  // bannerize
}
