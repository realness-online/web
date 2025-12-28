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
  pt = []

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
}

export default Path
