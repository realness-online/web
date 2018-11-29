const potrace = require('potrace')
function trace(avatar_image) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    var reader = new FileReader()
    reader.readAsArrayBuffer(avatar_image)
    reader.onload = function() {
      console.log('onload')
      var trace = new potrace.Potrace()
      trace.loadImage(this.result, error => {
        console.log('loadImage')
        if (error) throw error
        resolve(trace.getSymbol('avatar'))
      })
    }
  })
}
export default {
  trace
}
