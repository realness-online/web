/**
 * Represents a 2D point with x and y coordinates
 */
class Point {
  /**
   * @param {number} [x=0] - X coordinate
   * @param {number} [y=0] - Y coordinate
   */
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  /**
   * Creates a copy of the point
   * @returns {Point} New Point instance with same coordinates
   */
  copy = () => new Point(this.x, this.y)
}

export default Point
