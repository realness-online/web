import Point from '@/potrace/types/Point'

/**
 * Represents optimization parameters for curve fitting
 * @class
 * @property {Point[]} c - Control points
 * @property {number} alpha - Alpha value
 * @property {number} t - Parameter t
 * @property {number} s - Parameter s
 * @property {number} pen - Penalty value
 */
class Opti {
  /**
   * @type {number} Pen value
   */
  pen = 0

  /**
   * @type {Point[]} Control points
   */
  c = [new Point(), new Point()]

  /**
   * @type {number} T parameter
   */
  t = 0

  /**
   * @type {number} S parameter
   */
  s = 0

  /**
   * @type {number} Alpha parameter
   */
  alpha = 0
}

export default Opti
