// window.Buffer = require('buffer/').Buffer // note: the trailing slash is important!
require('jimp/browser/lib/jimp')
const potrace = require('potrace')
function trace(avatar_image) {
  return new Promise((resolve, reject) => {
    console.log('trace...')
    // let avatar_buffer = null
    var reader = new FileReader()
    reader.readAsArrayBuffer(avatar_image)
    reader.onload = function() {
      var trace = new potrace.Potrace()
      trace.loadImage(this.result, err => {
        if (err) throw err
        // console.log(this)
        resolve(trace.getSymbol('avatar'))
      })
    }
  })
}
export default {
  trace
}
// let reader = new FileReader()
// reader.onload = function(readerEvent) {
//   console.log('onload')
//   let arrayBuffer = this.result
//   let array = new Uint8Array(arrayBuffer)
//   let binaryString = String.fromCharCode.apply(null, array)
//   console.log(binaryString)
// }
// let avatar_data = reader.readAsArrayBuffer(avatar_image)
// console.log(avatar_data)
// var reader = new FileReader()
// var fileByteArray = []
// var hope_buffer = null
// reader.readAsArrayBuffer(avatar_image)
// reader.onloadend = function (evt) {
//   if (evt.target.readyState === FileReader.DONE) {
//     var arrayBuffer = evt.target.result
//     var array = new Uint8Array(arrayBuffer)
//     hope_buffer = new Uint8Array(arrayBuffer)
//     for (var i = 0; i < array.length; i++) {
//       fileByteArray.push(array[i])
//     }
//   }
// }
// document.querySelector('input').addEventListener('change', function() {
//   var reader = new FileReader();
//   reader.onload = function() {
//     var arrayBuffer = this.result
//     var array = new Uint8Array(arrayBuffer)
//     var binaryString = String.fromCharCode.apply(null, array)
//     console.log(binaryString);
//   }
//   reader.readAsArrayBuffer(this.files[0]);
// }, false);
