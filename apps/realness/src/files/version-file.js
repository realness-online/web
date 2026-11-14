/**
 * A file's sync version without holding it: the same hash `version_sync`
 * gives, computed as the bytes stream past. `unpack` hashes a packed
 * session's plain HTML, chained members included.
 */
import { createHash as create_hash } from 'node:crypto'
import { createReadStream as create_read_stream } from 'node:fs'
import {
  createGzip as create_gzip,
  createGunzip as create_gunzip
} from 'node:zlib'

const LENGTH = 22

/**
 * @param {import('node:stream').Readable} input
 * @param {import('node:stream').Readable} stream
 * @param {(chunk: Buffer) => void} on_data
 */
const drain = (input, stream, on_data) =>
  new Promise((resolve, reject) => {
    input.on('error', reject)
    stream
      .on('data', on_data)
      .on('error', reject)
      .on('end', () => resolve(undefined))
  })

/** @param {string} path */
export const gzipped_size = path => {
  let size = 0
  const input = create_read_stream(path)
  return drain(input, input.pipe(create_gzip()), chunk => {
    size += chunk.length
  }).then(() => size)
}

/** @param {string} path @param {{ unpack?: boolean }} [options] */
export const version_file = (path, { unpack = false } = {}) => {
  const hash = create_hash('sha256')
  const input = create_read_stream(path)
  const stream = unpack ? input.pipe(create_gunzip()) : input
  return drain(input, stream, chunk => hash.update(chunk)).then(() =>
    hash.digest('base64url').slice(0, LENGTH)
  )
}
