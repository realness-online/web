// https://github.com/jakearchibald/svgomg/blob/master/src/js/gzip-worker/index.js
// import { gzip } from 'pako'
import pako from 'pako'

self.onmessage = event => {
  console.log('Compressor')
  console.log('  before:', to_kb(event.data.vector))
  const result = pako.deflate(event.data.vector)
  console.log('  after:', to_kb(result))
  // self.postMessage({
  //   id: event.data.id,
  //   result
  // })
}
const to_kb = object => (object.length / 1024).toFixed(2)
