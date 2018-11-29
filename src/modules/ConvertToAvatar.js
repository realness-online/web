const potrace = require('potrace')
function trace(avatar_image) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    var reader = new FileReader()
    reader.readAsArrayBuffer(avatar_image)
    reader.onload = function() {
      console.log('onload')
      let trace = new potrace.Potrace()
      trace.loadImage(this.result, error => {
        console.log('loadImage')
        if (error) { reject(error) }
        resolve(trace.getSymbol('avatar'))
      })
    }
  })
}
function posterize(avatar_image) {
  return new Promise((resolve, reject) => {
    console.log('posterize...')
    var posterizer = new potrace.Posterize()
    posterizer.loadImage(avatar_image, function(error) {
      if (error) { reject(error) }
      posterizer.setParameter({
        steps: 2,
        threshold: 200,
        fillStrategy: potrace.Posterize.FILL_MEAN
      })
      resolve(posterizer.getSymbol('posterized-image'))
    })
  })
}
export default {
  trace,
  posterize
}
