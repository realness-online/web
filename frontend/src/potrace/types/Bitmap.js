import Point from '@/potrace/types/Point'
import utils from '@/potrace/utils'

/**
 * Represents a bitmap image as a 1-dimensional array of pixel values
 */
/** @typedef {import('./Histogram').default} Histogram */
class Bitmap {
  /** @type {Histogram | null} */
  #histogram = null

  /** @type {number} Width of the bitmap in pixels */
  width

  /** @type {number} Height of the bitmap in pixels */
  height

  /** @type {number} Total number of pixels (width * height) */
  size

  /** @type {ArrayBuffer} Underlying array buffer for pixel data */
  arrayBuffer

  /** @type {Uint8Array} Pixel data array */
  data

  /**
   * Creates a new Bitmap instance
   * @param {number} w - Width of the bitmap in pixels
   * @param {number} h - Height of the bitmap in pixels
   */
  constructor(w, h) {
    this.width = w
    this.height = h
    this.size = w * h
    this.arrayBuffer = new ArrayBuffer(this.size)
    this.data = new Uint8Array(this.arrayBuffer)
  }

  /**
   * Gets the pixel value at the specified coordinates or index
   * @param {number|Point} x - X coordinate or linear index
   * @param {number} [y] - Y coordinate if x is not an index
   * @returns {number} Pixel value at the specified position
   */
  get_value_at = (x, y) => {
    const index =
      typeof x === 'number' && typeof y !== 'number'
        ? x
        : this.point_to_index(x, y)
    return this.data[index]
  }

  /**
   * Converts a linear index to 2D coordinates
   * @param {number} index - Linear index in the bitmap array
   * @returns {Point} Point object containing x,y coordinates
   */
  index_to_point = index => {
    const point = new Point()

    if (utils.between(index, 0, this.size)) {
      point.y = Math.floor(index / this.width)
      point.x = index - point.y * this.width
    } else {
      point.x = -1
      point.y = -1
    }

    return point
  }

  /**
   * Converts 2D coordinates to a linear index
   * @param {Point|number} point_or_x - Point object or x coordinate
   * @param {number} [y] - Y coordinate if first parameter is x coordinate
   * @returns {number} Linear index in the bitmap array, -1 if coordinates are out of bounds
   */
  point_to_index = (point_or_x, y) => {
    let _x
    let _y

    if (point_or_x instanceof Point) {
      _x = point_or_x.x
      _y = point_or_x.y ?? 0
    } else {
      _x = point_or_x
      _y = y ?? 0
    }

    if (!utils.between(_x, 0, this.width) || !utils.between(_y, 0, this.height))
      return -1

    return this.width * _y + _x
  }

  /**
   * Creates a copy of the bitmap, optionally transforming pixel values
   * @param {function} [iterator] - Optional function to transform pixel values: (value, index) => newValue
   * @returns {Bitmap} New bitmap instance
   */
  copy = iterator => {
    const bm = new Bitmap(this.width, this.height)
    const iterator_present = typeof iterator === 'function'

    for (let i = 0; i < this.size; i++)
      bm.data[i] = iterator_present ? iterator(this.data[i], i) : this.data[i]

    return bm
  }

  /**
   * Sets the histogram for this bitmap
   * @param {Histogram} histogram - Histogram instance
   */
  set_histogram = histogram => {
    this.#histogram = histogram
  }

  /**
   * Gets the histogram of the bitmap's pixel values
   * @returns {import('./Histogram').default|null} Histogram instance for this bitmap
   */
  histogram = () => this.#histogram
}

export default Bitmap
