// https://github.com/jakearchibald/svgomg/blob/master/src/js/gzip-worker/index.js
import { gzip } from 'pako/lib/deflate'

self.onmessage = function (event) {
  try {
    var result = gzip(event.data.data).buffer
    self.postMessage({
      id: event.data.id,
      result: result
    })
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error.message
    })
  }
}
