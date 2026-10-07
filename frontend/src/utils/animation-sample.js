/**
 * @fileoverview Reads where a running SMIL leaf currently sits. A wind-down
 * that cannot wait for a cycle boundary needs that value to start its own leg
 * home from, otherwise the attribute jumps back to rest the moment the
 * running animation ends.
 */

/** Newton solves the spline's x for a time; a handful of steps lands well inside a pixel */
const SOLVE_STEPS = 8
const SOLVE_EPSILON = 1e-6

/** The 3 and 6 in a cubic Bezier's Bernstein terms and their derivative */
const CUBIC_TERM = 3
const SLOPE_TERM = 6

/**
 * A keySpline is the two middle control points of a cubic from (0,0) to
 * (1,1), same as CSS `cubic-bezier`.
 * @param {number} t
 * @param {number} first Control point on the axis being read
 * @param {number} second
 * @returns {number}
 */
const bezier_at = (t, first, second) => {
  const inverse = 1 - t
  return (
    CUBIC_TERM * inverse * inverse * t * first +
    CUBIC_TERM * inverse * t * t * second +
    t * t * t
  )
}

/**
 * @param {number} t
 * @param {number} first
 * @param {number} second
 * @returns {number}
 */
const bezier_slope_at = (t, first, second) => {
  const inverse = 1 - t
  return (
    CUBIC_TERM * inverse * inverse * first +
    SLOPE_TERM * inverse * t * (second - first) +
    CUBIC_TERM * t * t * (1 - second)
  )
}

/**
 * Eases a linear 0-1 position through a keySpline: solve the curve's x for
 * this time, read its y.
 * @param {number} fraction Linear position within the segment
 * @param {string} spline Four numbers, space separated, as SMIL writes them
 * @returns {number}
 */
export const spline_ease = (fraction, spline) => {
  const [x1, y1, x2, y2] = spline
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if ([x1, y1, x2, y2].some(Number.isNaN)) return fraction
  let t = fraction
  for (let step = 0; step < SOLVE_STEPS; step++) {
    const error = bezier_at(t, x1, x2) - fraction
    if (Math.abs(error) < SOLVE_EPSILON) break
    const slope = bezier_slope_at(t, x1, x2)
    if (Math.abs(slope) < SOLVE_EPSILON) break
    t -= error / slope
  }
  return bezier_at(t, y1, y2)
}

/** A scalar SMIL value: a number and whatever unit it carries, `0%` or `1.5` */
const as_scalar = value => {
  const match = /^(-?\d*\.?\d+)(.*)$/.exec(value.trim())
  if (!match) return null
  return { number: parseFloat(match[1]), unit: match[2].trim() }
}

/**
 * @param {string} from
 * @param {string} to
 * @param {number} fraction
 * @returns {string} `from` when either end is not a plain scalar
 */
const between = (from, to, fraction) => {
  const start = as_scalar(from)
  const end = as_scalar(to)
  if (!start || !end || start.unit !== end.unit) return from
  const number = start.number + (end.number - start.number) * fraction
  return `${number}${start.unit}`
}

/** Trailing semicolons are legal in a SMIL `values` list and mean nothing */
const as_list = attribute =>
  (attribute || '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0)

/**
 * The value a leaf's cycle rests on. Every animation here opens and closes on
 * it, which is what makes ending on a boundary invisible.
 * @param {Element} leaf
 * @returns {string | null}
 */
export const resting_value = leaf =>
  as_list(leaf.getAttribute('values'))[0] ?? null

/**
 * Where a leaf sits partway through its cycle.
 * @param {Element} leaf An `<animate>` with `values` (and usually `keyTimes`, `keySplines`)
 * @param {number} elapsed Seconds into the current cycle
 * @returns {string | null} Null when the leaf carries nothing to read
 */
export const sample_smil = (leaf, elapsed) => {
  const values = as_list(leaf.getAttribute('values'))
  if (values.length < 2) return values[0] ?? null
  const dur = parseFloat(leaf.getAttribute('dur') || '')
  if (!dur) return values[0]

  const fraction = Math.min(Math.max((elapsed % dur) / dur, 0), 1)
  const times = as_list(leaf.getAttribute('keyTimes')).map(Number)
  const key_times =
    times.length === values.length
      ? times
      : values.map((_, index) => index / (values.length - 1))

  let segment = key_times.length - 2
  for (let index = 0; index < key_times.length - 1; index++)
    if (fraction < key_times[index + 1]) {
      segment = index
      break
    }

  const span = key_times[segment + 1] - key_times[segment]
  const local = span > 0 ? (fraction - key_times[segment]) / span : 0
  const splines = as_list(leaf.getAttribute('keySplines'))
  const eased = splines[segment] ? spline_ease(local, splines[segment]) : local
  return between(values[segment], values[segment + 1], eased)
}
