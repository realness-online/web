import crypto from 'node:crypto'
import pako from 'pako'

const compress_data = data => {
  const uint8_array = new TextEncoder().encode(data)
  return pako.deflate(uint8_array, {
    level: 9
  })
}

const create_hash = (data, algorithm = 'SHA-256') => {
  const hash = crypto.createHash(algorithm.toLowerCase())
  hash.update(data)
  return hash.digest('base64')
}

export const prepare_upload_data = async (items, path) => {
  const data = compress_data(items, path)
  const content_hash = create_hash(items)

  return {
    data,
    content_hash,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'en-US',
      contentEncoding: 'deflate',
      contentDisposition: 'inline',
      customMetadata: {
        hash: content_hash
      }
    }
  }
}
