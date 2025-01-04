import pako from 'pako'
import { to_kb, OPEN_ANGLE } from '@/utils/numbers'

export const compress_html = message => {
  console.time('compress:html')
  console.group('Compressor')
  console.info(`before: ${to_kb(message.data.html)}kb`)
  const uint8_array = new TextEncoder().encode(message.data.html)
  const result = pako.deflate(uint8_array, {
    level: 9
  })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  console.info(`after: ${to_kb(blob)}kb`)
  console.groupEnd()
  console.timeEnd('compress:html')
  return { blob }
}

export const decompress_html = message => {
  console.time('decompress:html')
  const compressed_data = new Uint8Array(message.data.compressed)

  // Check if data starts with '<' (ASCII 60) - indicating uncompressed HTML/SVG
  if (compressed_data[0] === OPEN_ANGLE)
    return { html: new TextDecoder().decode(compressed_data) }

  // Otherwise proceed with decompression
  const html = pako.inflate(compressed_data, {
    to: 'string'
  })
  console.timeEnd('decompress:html')
  return { html }
}

export const route_message = async message => {
  const { route } = message.data
  let reply = {}

  switch (route) {
    case 'compress:html':
      reply = compress_html(message)
      break
    case 'decompress:html':
      reply = decompress_html(message)
      break
    default:
      console.warn('unknown route', route)
      reply = { error: `Unknown route: ${route}` }
  }

  return reply
}
self.addEventListener('message', async event => {
  const reply = await route_message(event)
  self.postMessage(reply)
})
