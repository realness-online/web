/**
 * Frame-rate-independent exponential smoothing (continuous settle, no per-frame lerp drift).
 *
 * @param {number} current
 * @param {number} target
 * @param {number} rate_per_s higher = snappier
 * @param {number} delta_s
 */
export const smooth_toward = (current, target, rate_per_s, delta_s) => {
  if (rate_per_s <= 0 || delta_s <= 0) return target
  const t = 1 - Math.exp(-rate_per_s * delta_s)
  return current + (target - current) * t
}

/**
 * @param {{ target: { x: number, y: number }, current: { x: number, y: number } }} pan
 * @param {number} dx
 * @param {number} dy
 */
export const nudge_pan = (pan, dx, dy) => {
  pan.target.x += dx
  pan.target.y += dy
  pan.current.x += dx
  pan.current.y += dy
}
