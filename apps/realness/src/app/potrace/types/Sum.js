/**
 * Represents a sum of coordinates and their products
 * @class
 * @property {number} x - Sum of x coordinates
 * @property {number} y - Sum of y coordinates
 * @property {number} xy - Sum of x*y products
 * @property {number} x2 - Sum of x^2 values
 * @property {number} y2 - Sum of y^2 values
 */
class Sum {
  /**
   * @param {number} x - Sum of x coordinates
   * @param {number} y - Sum of y coordinates
   * @param {number} xy - Sum of x*y products
   * @param {number} x2 - Sum of x^2
   * @param {number} y2 - Sum of y^2
   */
  constructor(x, y, xy, x2, y2) {
    this.x = x
    this.y = y
    this.xy = xy
    this.x2 = x2
    this.y2 = y2
  }
}

export default Sum
