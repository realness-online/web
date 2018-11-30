const potrace = require('potrace')
const Jimp = require('jimp')
const EXIF = require('exif-js')
const phone_is = {
  portate: 6
}
function orient(avatar) {
  EXIF.getData(avatar, () => {
    let orientation = avatar.exifdata.Orientation
    console.log(orientation, phone_is, avatar.exifdata)
    return orientation
  })
}
function resize(image) {}
function trace(avatar) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    let trace = new potrace.Potrace()
    trace.setParameters({threshold: 100})
    let reader = new FileReader()
    reader.readAsArrayBuffer(avatar)
    reader.onload = function() {
      console.log('buffered')
      let buffer = this.result
      Jimp.read(buffer).then(image => {
        EXIF.getData(avatar, () => {
          image = image.resize(200, Jimp.AUTO)
          if (avatar.exifdata.Orientation === 6) {
            console.log('rotate', '4')
            image = image.rotate(-90)
          }
          trace.loadImage(image, error => {
            console.log('loadImage')
            if (error) { reject(error) }
            resolve(trace.getSymbol('avatar'))
          })
        })
      })
    }
  })
}
function posterize(poster) {
  return new Promise((resolve, reject) => {
    console.log('posterize...')
    var posterizer = new potrace.Posterize()
    posterizer.loadImage(poster, function(error) {
      if (error) { reject(error) }
      posterizer.setParameter({
        steps: 2,
        threshold: 200
      })
      resolve(posterizer.getSymbol('poster'))
    })
  })
}
function bannerize(banner) {}
export default {
  orient,
  resize,
  trace,
  posterize,
  bannerize
}
