import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import crypto from 'node:crypto'

const gzip_async = promisify(gzip)

const compress_data = data => gzip_async(data)

const create_hash = (data, algorithm = 'SHA-256') => {
  const hash = crypto.createHash(algorithm.toLowerCase())
  hash.update(data)
  return hash.digest('base64')
}

export const prepare_upload_data = async (items, path) => {
  const data = await compress_data(items, path)
  const content_hash = create_hash(items)

  return {
    data,
    content_hash,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'en-US',
      contentEncoding: 'gzip',
      contentDisposition: 'inline',
      customMetadata: {
        hash: content_hash
      }
    }
  }
}
