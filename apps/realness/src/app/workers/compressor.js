import { gzip, inflate } from 'pako'
import { OPEN_ANGLE } from '@/utils/numbers'
import { version_of } from '#root/src/files/version.js'

/** Hash the plain bytes, then gzip them: the version never sees the gzip. */
export const compress_html = async message => {
  const uint8_array = new TextEncoder().encode(message.data.html)
  const version = await version_of(uint8_array)
  const result = gzip(uint8_array, {
    level: 9
  })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  return { blob, version }
}

export const decompress_html = message => {
  const compressed_data = new Uint8Array(message.data.compressed)

  if (compressed_data[0] === OPEN_ANGLE)
    return { html: new TextDecoder().decode(compressed_data) }

  const html = inflate(compressed_data, {
    toText: true
  })
  return { html }
}

export const route_message = async message => {
  const { route } = message.data
  let reply = {}

  switch (route) {
    case 'compress:html':
      reply = await compress_html(message)
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
  try {
    const reply = await route_message(event)
    self.postMessage(reply)
  } catch (error) {
    console.error('Error in message handler:', error)
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    })
  }
})
