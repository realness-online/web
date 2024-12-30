/**
 * Represents a 3x3 quadratic matrix
 */
class Quad {
  /**
   * @type {number[]} Matrix data stored as 1D array
   */
  data = new Array(9).fill(0)

  /**
   * Gets the value at specified coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Value at the specified position
   */
  at = (x, y) => this.data[x * 3 + y]
}

export default Quad
