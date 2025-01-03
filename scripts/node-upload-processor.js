import { gzip } from 'zlib'
import { promisify } from 'util'
import crypto from 'crypto'

const gzip_async = promisify(gzip)

const compress_data = async (data, filename = 'data') => await gzip_async(data)

const create_hash = async (data, algorithm = 'SHA-256') => {
  const hash = crypto.createHash(algorithm.toLowerCase())
  hash.update(data)
  return hash.digest('base64')
}

export const prepare_upload_data = async (items, path) => {
  const data = await compress_data(items, path)
  const content_hash = await create_hash(items)
  const md5_hash = await create_hash(items, 'MD5')

  return {
    data,
    content_hash,
    md5_hash,
    metadata: {
      cacheControl: 'private, max-age=18000',
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'en-US', // Note: Using default since Node doesn't have navigator
      contentEncoding: 'gzip',
      contentDisposition: 'inline',
      md5Hash: md5_hash,
      customMetadata: {
        hash: content_hash
      }
    }
  }
}
