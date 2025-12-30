/**
 * Represents a 3x3 quadratic matrix
 * @class
 * @property {number[]} data - 3x3 matrix stored as flat array
 * @property {function(number, number): number} at - Function to get value at position
 */

// Constants
const MATRIX_SIZE = 9 // 3x3 matrix = 9 elements
const MATRIX_DIMENSION = 3

class Quad {
  static MATRIX_SIZE = MATRIX_SIZE

  /**
   * @type {number[]} Matrix data stored as 1D array
   */
  data = new Array(Quad.MATRIX_SIZE).fill(0)

  /**
   * Gets the value at specified coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Value at the specified position
   */
  at = (x, y) => this.data[x * MATRIX_DIMENSION + y]
}

export default Quad
