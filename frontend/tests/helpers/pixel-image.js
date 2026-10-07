/**
 * Pixel buffers for tests that need a picture rather than a shape.
 *
 * The vector worker used to be tested against a canvas mock that answered
 * every read with four zero bytes, so any assertion about colour was really
 * an assertion about nothing. These builders make small images whose correct
 * average is known by hand.
 */

const RGBA = 4

/**
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number) => [number, number, number, number]} paint
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export const make_image_data = (width, height, paint) => {
  const data = new Uint8ClampedArray(width * height * RGBA)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y)
      const i = (y * width + x) * RGBA
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
  return { data, width, height }
}

/** A black to white ramp along x, fully opaque. */
export const horizontal_ramp = (width, height) =>
  make_image_data(width, height, x => {
    const value = Math.round((x / (width - 1)) * 255)
    return [value, value, value, 255]
  })

/** A flat colour, fully opaque. */
export const solid = (width, height, [r, g, b]) =>
  make_image_data(width, height, () => [r, g, b, 255])
