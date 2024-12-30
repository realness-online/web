/**
 * Represents a curve in the potrace algorithm
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
