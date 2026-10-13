/**
 * Represents a path in the potrace algorithm
 * Contains information about the path's area, length, curve data, and bounding box
 */
class Path {
  /**
   * @type {number} Area of the path
   */
  area = 0

  /**
   * @type {number} Length of the path
   */
  len = 0

  /**
   * @type {'+' | '-'} Sign indicating whether path is black or white
   */
  sign = '+'

  /**
   * @type {Object} Curve data for the path
   */
  curve = {}

  /**
   * @type {Array} Array of points defining the path
   */
  points = []

  /**
   * @type {number} Minimum X coordinate of the path's bounding box
   */
  min_x = Number.MAX_SAFE_INTEGER

  /**
   * @type {number} Minimum Y coordinate of the path's bounding box
   */
  min_y = Number.MAX_SAFE_INTEGER

  /**
   * @type {number} Maximum X coordinate of the path's bounding box
   */
  max_x = -1

  /**
   * @type {number} Maximum Y coordinate of the path's bounding box
   */
  max_y = -1

  /**
   * @type {number} [x0] - Origin X coordinate for relative calculations
   */
  x0

  /**
   * @type {number} [y0] - Origin Y coordinate for relative calculations
   */
  y0

  /**
   * @type {Array} [sums] - Running sums for optimization calculations
   */
  sums

  /**
   * @type {number[]} [longest_straight_seq] - Longest straight sequence indices
   */
  longest_straight_seq

  /**
   * @type {number} [m] - Number of optimal vertices
   */
  m

  /**
   * @type {number[]} [optimal_vertices] - Optimal vertex indices
   */
  optimal_vertices
}

export default Path
