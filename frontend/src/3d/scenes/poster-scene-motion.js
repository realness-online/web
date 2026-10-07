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
 * Piecewise-linear sample of SMIL-style keyframes, looping over period_s.
 * Linear because SMIL only splines with `calcMode="spline"`, which the poster
 * markup omits - so this is what the 2D poster actually draws.
 *
 * @param {number} elapsed_s
 * @param {number} period_s
 * @param {{ at: number, value: number }[]} frames `at` normalised 0..1, ascending
 */
export const sample_keyframes = (elapsed_s, period_s, frames) => {
  if (frames.length < 2) return frames[0]?.value ?? 0
  if (period_s <= 0) return frames[0].value

  const t = (((elapsed_s / period_s) % 1) + 1) % 1
  let i = 1
  while (i < frames.length - 1 && t > frames[i].at) i++

  const span = frames[i].at - frames[i - 1].at
  const local = span > 0 ? (t - frames[i - 1].at) / span : 0
  return frames[i - 1].value + (frames[i].value - frames[i - 1].value) * local
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
