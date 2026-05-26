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

/**
 * @param {number} elapsed_s
 * @param {number} period_s
 * @param {number} base_opacity
 * @param {number} min_opacity
 */
export const stroke_pulse_opacity = (
  elapsed_s,
  period_s,
  base_opacity,
  min_opacity
) => {
  const wave = Math.cos((elapsed_s * Math.PI * 2) / period_s)
  return min_opacity + ((base_opacity - min_opacity) * (wave + 1)) / 2
}
