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
    this.tag = new Array(n)
    this.c = new Array(n * 3)
    this.alpha_curve = 0
    this.vertex = new Array(n)
    this.alpha = new Array(n)
    this.alpha0 = new Array(n)
    this.beta = new Array(n)
  }
}

export default Curve
