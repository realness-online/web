/**
 * Represents a curve in the potrace algorithm
 * @class
 * @property {number} n - Number of vertices
 * @property {Point[]} vertex - Array of vertex points
 * @property {('CORNER'|'CURVE')[]} tag - Type of each vertex
 * @property {Point[]} c - Control points
 * @property {number[]} alpha - Alpha values for each vertex
 * @property {number[]} alpha0 - Initial alpha values
 * @property {number[]} beta - Beta values for each vertex
 * @property {boolean} alpha_curve - Whether curve uses alpha values
 */
class Curve {
  /**
   * @param {number} n - Number of points in the curve
   */
  constructor(n) {
    this.n = n
    this.tag = Array.from({ length: n })
    this.c = Array.from({ length: n * 3 })
    this.alpha_curve = 0
    this.vertex = Array.from({ length: n })
    this.alpha = Array.from({ length: n })
    this.alpha0 = Array.from({ length: n })
    this.beta = Array.from({ length: n })
  }
}

export default Curve
