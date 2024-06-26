// https://github.com/jakearchibald/svgomg/blob/master/src/js/gzip-worker/index.js
// import { gzip } from 'pako'
import pako from 'pako'

self.onmessage = event => {
  console.log('Compressor')
  console.log(`  before: ${to_kb(event.data.vector)}kb`)
  const result = pako.deflate(event.data.vector, { gzip: true })
  console.log(`  after: ${to_kb(result)}kb`)
  // self.postMessage({
  //   id: event.data.id,
  //   result
  // })
}
const to_kb = object => (object.length / 1024).toFixed(1)
