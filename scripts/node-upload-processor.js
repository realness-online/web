import crypto from 'node:crypto'
import pako from 'pako'

const compress_html = html => {
  const uint8_array = new TextEncoder().encode(html)
  return pako.deflate(uint8_array, {
    level: 9
  })
}

const create_hash = html => {
  const hash = crypto.createHash('SHA-256')
  hash.update(html)
  return hash.digest('base64')
}

export const prepare_upload_html = html => {
  const compressed = compress_html(html)
  const hash = create_hash(html)

  return {
    compressed,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'en-US',
      contentEncoding: 'deflate',
      contentDisposition: 'inline',
      customMetadata: {
        hash
      }
    }
  }
}
