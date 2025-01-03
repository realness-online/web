import pako from 'pako'
import { to_kb } from '@/utils/numbers'

export const compress_data = message => {
  console.time('compress:data')
  console.info('Compressor')
  console.info(`  before: ${to_kb(message.data.html)}kb`)

  const uint8_array = new TextEncoder().encode(message.data.html)

  const result = pako.gzip(uint8_array, {
    level: 9,
    header: {
      name: message.data.filename
    }
  })

  const blob = new Blob([result], { type: 'application/gzip' })
  console.info(`  after: ${(blob.size / 1024).toFixed(2)}kb`)
  console.timeEnd('compress:data')
  return result
}

export const decompress_data = message => {
  try {
    const decompressed = pako.inflate(new Uint8Array(message.data.compressed), {
      to: 'string'
    })
    return decompressed
  } catch (error) {
    return { error: error.message }
  }
}

export const route_message = async message => {
  const { route } = message.data
  let reply = {}

  switch (route) {
    case 'compress:data':
      reply = compress_data(message)
      break
    case 'decompress:data':
      reply = decompress_data(message)
      break
    default:
      console.warn('unknown route', route)
  }

  return reply
}
self.addEventListener('message', async event => {
  console.info('message', event)
  const reply = await route_message(event)
  self.postMessage(reply)
})
