// https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
// Kilobytes = Bytes ÷ 1,024
function format_bytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return  `${size} ${sizes[i]}`
}
export default {
  rough_bytes(object){
    return this.rough(object)
  },
  rough_kb(object) {
    return (this.rough(object) / 1024).toFixed(0)
  },
  rough_display(object){
    return format_bytes(this.rough(object), 0)
  },
  rough(object) {
    const objectList = []
    const stack = [ object ]
    var bytes = 0
    while ( stack.length ) {
      const value = stack.pop()
      switch (typeof value) {
        case 'boolean':
          bytes += 4
          break;
        case 'string':
          bytes += value.length * 2
          break;
        case 'number':
          bytes += 8
          break;
        case 'object':
          if (objectList.indexOf( value ) === -1) {
            objectList.push( value )
            for( var i in value ) {
              stack.push( value[ i ] )
            }
          }
          break;
        default:
          console.log(typeof value)
          break;
      }
    }
    return bytes
  }
}
