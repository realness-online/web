import Point from '@/potrace/types/Point'
import utils from '@/potrace/utils'
import Histogram from '@/potrace/types/Histogram'

class Bitmap {
  #histogram = null
  width
  height
  size
  arrayBuffer
  data

  constructor(w, h) {
    this.width = w
    this.height = h
    this.size = w * h
    this.arrayBuffer = new ArrayBuffer(this.size)
    this.data = new Uint8Array(this.arrayBuffer)
  }

  get_value_at = (x, y) => {
    const index =
      typeof x === 'number' && typeof y !== 'number'
        ? x
        : this.point_to_index(x, y)
    return this.data[index]
  }

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

  point_to_index = (point_or_x, y) => {
    let _x = point_or_x
    let _y = y

    if (point_or_x instanceof Point) {
      _x = point_or_x.x
      _y = point_or_x.y
    }

    if (
      !utils.between(_x, 0, this.width) ||
      !utils.between(_y, 0, this.height)
    ) {
      return -1
    }

    return this.width * _y + _x
  }

  copy = iterator => {
    const bm = new Bitmap(this.width, this.height)
    const iterator_present = typeof iterator === 'function'

    for (let i = 0; i < this.size; i++) {
      bm.data[i] = iterator_present ? iterator(this.data[i], i) : this.data[i]
    }

    return bm
  }

  histogram = () => {
    if (this.#histogram) {
      return this.#histogram
    }

    this.#histogram = new Histogram(this)
    return this.#histogram
  }
}

export default Bitmap
