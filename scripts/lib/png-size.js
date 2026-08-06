const PNG_SIGNATURE = Buffer.from('\x89PNG\r\n\x1a\n', 'binary')
const CHUNK_TYPE_AT = 12
const CHUNK_TYPE_END = 16
const WIDTH_AT = 16
const HEIGHT_AT = 20
const IHDR_HEADER_BYTES = 24

/**
 * Read a png's dimensions from its IHDR chunk, which is always the first 24
 * bytes. Enough to tell whether a frame on disk was rastered at the size this
 * run wants, without reading a multi-megabyte file to find out.
 *
 * @param {Buffer} [buffer] - at least the first 24 bytes of the file
 * @returns {{ width: number, height: number } | null}
 */
export const read_png_size = buffer => {
  if (!buffer || buffer.length < IHDR_HEADER_BYTES) return null
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
    return null
  if (buffer.toString('ascii', CHUNK_TYPE_AT, CHUNK_TYPE_END) !== 'IHDR')
    return null
  return {
    width: buffer.readUInt32BE(WIDTH_AT),
    height: buffer.readUInt32BE(HEIGHT_AT)
  }
}

export { IHDR_HEADER_BYTES }
