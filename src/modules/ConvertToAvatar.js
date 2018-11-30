const potrace = require('potrace')
const Jimp = require('jimp')

function trace(avatar_image) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    let trace = new potrace.Potrace()
    trace.setParameters({threshold: 100})
    let reader = new FileReader()
    reader.readAsArrayBuffer(avatar_image)
    reader.onload = function() {
      console.log('onload')
      let buffer = this.result
      Jimp.read(buffer).then(image => {
        const resized = image.resize(200, Jimp.AUTO)
        trace.loadImage(resized, error => {
          console.log('loadImage')
          if (error) { reject(error) }
          resolve(trace.getSymbol('avatar'))
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
function resize(image) {}
function bannerize(banner) {}
export default {
  resize,
  trace,
  posterize,
  bannerize
}
