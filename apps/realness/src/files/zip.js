/**
 * One zip for the same content, wherever it runs: fixed level, mtime 0, and
 * a fixed OS byte, so a Mac and a Linux halo agree byte for byte. Versions
 * hash plain bytes, so this is for tidy stores, not for agreement.
 */
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from 'node:zlib'

const LEVEL = 6
const OS_BYTE = 9
/** The gzip header's 4-byte mtime starts here (RFC 1952). */
const MTIME_AT = 4
const UNIX = 3

/**
 * The same bytes for the same content, wherever it runs.
 * @param {Uint8Array} bytes
 */
export const zip = bytes => {
  const packed = gzip_sync(bytes, { level: LEVEL })
  packed.writeUInt32LE(0, MTIME_AT)
  packed[OS_BYTE] = UNIX
  return packed
}

/** @param {Uint8Array} bytes */
export const unzip = bytes => gunzip_sync(bytes)
