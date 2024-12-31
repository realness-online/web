import pako from 'pako'
import { to_kb } from '@/use/number'

const compress_data = message => {
  console.time('compress:data')
  console.log('Compressor')
  console.log(`  before: ${to_kb(message.data.html)}kb`)

  const uint8_array = new TextEncoder().encode(message.data.html)

  const result = pako.gzip(uint8_array, {
    level: 9,
    header: {
      name: message.data.filename
    }
  })

  const blob = new Blob([result], { type: 'application/gzip' })
  console.log(`  after: ${(blob.size / 1024).toFixed(2)}kb`)
  console.timeEnd('compress:data')
  return result
}

const decompress_data = message => {
  try {
    const decompressed = pako.inflate(new Uint8Array(message.data.compressed), { to: 'string' })
    return decompressed
  } catch (error) {
    return { error: error.message }
  }
}

export const route_message = async message => {
  const route = message.data.route
  let reply = {}

  switch (route) {
    case 'compress:data':
      reply = compress_data(message)
      break
    case 'decompress:data':
      reply = decompress_data(message)
      break
    default:
      console.log('unknown route', route)
  }

  self.postMessage(reply)
}
self.addEventListener('message', route_message)
