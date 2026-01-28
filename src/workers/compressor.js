import pako from 'pako'
import { OPEN_ANGLE } from '@/utils/numbers'

export const compress_html = message => {
  const uint8_array = new TextEncoder().encode(message.data.html)
  const result = pako.deflate(uint8_array, {
    level: 9
  })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  return { blob }
}

export const decompress_html = message => {
  const compressed_data = new Uint8Array(message.data.compressed)

  // Check if data starts with '<' (ASCII 60) - indicating uncompressed HTML/SVG
  if (compressed_data[0] === OPEN_ANGLE)
    return { html: new TextDecoder().decode(compressed_data) }

  // Otherwise proceed with decompression
  const html = pako.inflate(compressed_data, {
    to: 'string'
  })
  return { html }
}

export const route_message = message => {
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
      reply = { error: `Unknown route: ${route}` }
  }

  return reply
}
self.addEventListener('message', async event => {
  const reply = await route_message(event)
  self.postMessage(reply)
})
