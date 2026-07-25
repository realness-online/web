const SOI = 0xd8
const MARKER = 0xff
const SOF_FIRST = 0xc0
const SOF_LAST = 0xcf
// Frame markers that share the SOF range but carry no dimensions.
const NOT_A_FRAME = [0xc4, 0xc8, 0xcc]
const HEADER_BYTES = 2
const SEGMENT_LENGTH_BYTES = 2
const HEIGHT_OFFSET = 5
const WIDTH_OFFSET = 7

/**
 * Read a jpeg's pixel dimensions from its start-of-frame segment. Enough to
 * check a file is the size it claims without pulling in an image library.
 *
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number } | null}
 */
export const read_jpeg_size = buffer => {
  if (buffer[0] !== MARKER || buffer[1] !== SOI) return null

  let offset = HEADER_BYTES
  while (offset < buffer.length) {
    if (buffer[offset] !== MARKER) return null
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + HEADER_BYTES)

    if (
      marker >= SOF_FIRST &&
      marker <= SOF_LAST &&
      !NOT_A_FRAME.includes(marker)
    )
      return {
        height: buffer.readUInt16BE(offset + HEIGHT_OFFSET),
        width: buffer.readUInt16BE(offset + WIDTH_OFFSET)
      }

    offset += SEGMENT_LENGTH_BYTES + length
  }
  return null
}
