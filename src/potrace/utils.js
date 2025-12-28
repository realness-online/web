/**
 * @typedef {import('@/potrace/types/Point').default} Point
 * A 2D point with x and y coordinates
 */

import Point from '@/potrace/types/Point'

const attr_regexps = {}

/**
 * Creates or retrieves a cached RegExp for matching HTML attributes
 * @param {string} attr_name - The name of the HTML attribute to match
 * @returns {RegExp} A regular expression that matches the attribute and its value
 */
const get_attr_regexp = attr_name => {
  if (attr_regexps[attr_name]) return attr_regexps[attr_name]

  attr_regexps[attr_name] = new RegExp(
    ` ${attr_name}="((?:\\\\(?=")"|[^"])+)"`,
    'i'
  )
  return attr_regexps[attr_name]
}

/**
 * Sets or updates an HTML attribute in an HTML string
 * @param {string} html - The HTML string to modify
 * @param {string} attr_name - The name of the attribute to set
 * @param {string} value - The value to set for the attribute
 * @returns {string} The modified HTML string
 */
export const set_html_attr = (html, attr_name, value) => {
  const attr = ` ${attr_name}="${value}"`
  let result = html

  if (result.indexOf(` ${attr_name}="`) === -1)
    result = result.replace(/<[a-z]+/i, beginning => beginning + attr)
  else result = result.replace(get_attr_regexp(attr_name), attr)

  return result
}

/**
 * Formats a number with up to 3 decimal places, removing trailing zeros
 * @param {number} number - The number to format
 * @returns {string} The formatted number as a string
 */
const fixed = number => number.toFixed(3).replace('.000', '')

/**
 * Calculates the positive modulo. Different from JavaScript's % operator,
 * this always returns a non-negative number
 * @param {number} a - The dividend
 * @param {number} n - The divisor
 * @returns {number} The positive modulo result
 */
export const mod = (a, n) => {
  if (a >= n) return a % n
  if (a >= 0) return a
  return n - 1 - ((-1 - a) % n)
}

/**
 * Calculates the cross product of two 2D vectors
 * @param {Point} p1 - First point vector
 * @param {Point} p2 - Second point vector
 * @returns {number} The cross product value
 */
export const xprod = (p1, p2) => p1.x * p2.y - p1.y * p2.x

/**
 * Checks if b lies within the cyclic range from a to c
 * @param {number} a - Start of range
 * @param {number} b - Value to check
 * @param {number} c - End of range
 * @returns {boolean} True if b is in the cyclic range from a to c
 */
export const cyclic = (a, b, c) => (a <= c ? a <= b && b < c : a <= b || b < c)

/**
 * Returns the sign of a number: 1 for positive, -1 for negative, 0 for zero
 * @param {number} i - The number to check
 * @returns {-1 | 0 | 1} The sign indicator
 */
export const sign = i => {
  if (i > 0) return 1
  if (i < 0) return -1
  return 0
}

/**
 * Calculates the quadratic form for curve optimization
 * @param {Object} Q - Matrix-like object representing the quadratic form
 * @param {function(number, number): number} Q.at - Method to access matrix elements
 * @param {Point} w - Point to evaluate
 * @returns {number} The quadratic form value
 */
export const quadform = (Q, w) => {
  const v = [w.x, w.y, 1]
  let sum = 0

  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) sum += v[i] * Q.at(i, j) * v[j]

  return sum
}

/**
 * Calculates a point on the line between two points using linear interpolation
 * @param {number} lambda - Interpolation parameter (0 to 1)
 * @param {Point} a - Start point
 * @param {Point} b - End point
 * @returns {Point} The interpolated point
 */
export const interval = (lambda, a, b) => {
  const res = new Point()
  res.x = a.x + lambda * (b.x - a.x)
  res.y = a.y + lambda * (b.y - a.y)
  return res
}

/**
 * Computes the direction of the perpendicular vector at infinity
 * Used in curve optimization for determining curve directions
 * @param {Point} p0 - Start point
 * @param {Point} p2 - End point
 * @returns {Point} Direction vector
 */
export const dorth_infinity = (p0, p2) => {
  const r = new Point()
  r.y = sign(p2.x - p0.x)
  r.x = -sign(p2.y - p0.y)
  return r
}

export const ddenom = (p0, p2) => {
  const r = dorth_infinity(p0, p2)
  return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y)
}

export const dpara = (p0, p1, p2) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p2.x - p0.x
  const y2 = p2.y - p0.y

  return x1 * y2 - x2 * y1
}

export const cprod = (p0, p1, p2, p3) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p3.x - p2.x
  const y2 = p3.y - p2.y

  return x1 * y2 - x2 * y1
}

export const iprod = (p0, p1, p2) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p2.x - p0.x
  const y2 = p2.y - p0.y

  return x1 * x2 + y1 * y2
}

export const iprod1 = (p0, p1, p2, p3) => {
  const x1 = p1.x - p0.x
  const y1 = p1.y - p0.y
  const x2 = p3.x - p2.x
  const y2 = p3.y - p2.y

  return x1 * x2 + y1 * y2
}

export const ddist = (p, q) =>
  Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y))

export const luminance = (r, g, b) =>
  Math.round(0.2126 * r + 0.7153 * g + 0.0721 * b)

export const between = (val, min, max) => val >= min && val <= max

export const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

export const is_number = val => typeof val === 'number'

/**
 * @typedef {Object} Curve
 * @property {Point[]} c - Array of curve points, where each set of 3 points represents
 *                        the control points of a Bézier curve segment
 * @property {number} n - Number of curve segments
 * @property {('CURVE'|'CORNER')[]} tag - Type of each segment: 'CURVE' for smooth
 *                                       Bézier curves, 'CORNER' for sharp corners
 */

/**
 * Converts a curve object into an SVG path data string
 * @param {Curve} curve - The curve to render
 * @param {number} [scale=1] - Optional scale factor for the coordinates
 * @returns {string} SVG path data string using absolute coordinates
 */
export const render_curve = (curve, scale = 1) => {
  const starting_point = curve.c[(curve.n - 1) * 3 + 2]
  let path = `M ${fixed(starting_point.x * scale)} ${fixed(starting_point.y * scale)} `

  curve.tag.forEach((tag, i) => {
    const i3 = i * 3
    const p0 = curve.c[i3]
    const p1 = curve.c[i3 + 1]
    const p2 = curve.c[i3 + 2]

    if (tag === 'CURVE') {
      path += `C ${fixed(p0.x * scale)} ${fixed(p0.y * scale)}, `
      path += `${fixed(p1.x * scale)} ${fixed(p1.y * scale)}, `
      path += `${fixed(p2.x * scale)} ${fixed(p2.y * scale)} `
    } else if (tag === 'CORNER') {
      path += `L ${fixed(p1.x * scale)} ${fixed(p1.y * scale)} `
      path += `${fixed(p2.x * scale)} ${fixed(p2.y * scale)} `
    }
  })

  return path
}

/**
 * Calculates a point on a cubic Bézier curve at parameter t
 * @param {number} t - Parameter between 0 and 1
 * @param {Point} p0 - Start point
 * @param {Point} p1 - First control point
 * @param {Point} p2 - Second control point
 * @param {Point} p3 - End point
 * @returns {Point} The point on the curve at parameter t
 */
export const bezier = (t, p0, p1, p2, p3) => {
  const s = 1 - t
  const res = new Point()

  res.x =
    s * s * s * p0.x +
    3 * (s * s * t) * p1.x +
    3 * (t * t * s) * p2.x +
    t * t * t * p3.x
  res.y =
    s * s * s * p0.y +
    3 * (s * s * t) * p1.y +
    3 * (t * t * s) * p2.y +
    t * t * t * p3.y

  return res
}

/**
 * Finds the parameter value where a line intersects a Bézier curve
 * @param {Point} p0 - Bézier curve start point
 * @param {Point} p1 - First control point
 * @param {Point} p2 - Second control point
 * @param {Point} p3 - Bézier curve end point
 * @param {Point} q0 - First point defining the line
 * @param {Point} q1 - Second point defining the line
 * @returns {number} Parameter value t at intersection, or -1 if no intersection
 */
export const tangent = (p0, p1, p2, p3, q0, q1) => {
  const A = cprod(p0, p1, q0, q1)
  const B = cprod(p1, p2, q0, q1)
  const C = cprod(p2, p3, q0, q1)

  const a = A - 2 * B + C
  const b = -2 * A + 2 * B
  const c = A

  const d = b * b - 4 * a * c

  if (a === 0 || d < 0) return -1.0

  const s = Math.sqrt(d)

  const r1 = (-b + s) / (2 * a)
  const r2 = (-b - s) / (2 * a)

  if (r1 >= 0 && r1 <= 1) return r1
  if (r2 >= 0 && r2 <= 1) return r2
  return -1.0
}

export default {
  luminance,
  between,
  clamp,
  is_number,
  set_html_attr,
  render_curve,
  bezier,
  tangent,
  mod,
  xprod,
  cyclic,
  sign,
  quadform,
  interval,
  ddenom,
  dpara,
  cprod,
  iprod,
  iprod1,
  ddist,
  dorth_infinity
}
