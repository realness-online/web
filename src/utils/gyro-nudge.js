/**
 * Tilt nudges the morph timeline. SMIL keyframes carry whole path strings,
 * so tilt cannot add to `d` directly - instead the tilt magnitude scrubs the
 * svg's document time forward and back. Only the smoothed delta is applied
 * each frame, so the natural clock keeps running and a settling device eases
 * the timeline back instead of snapping it.
 */

/** Seconds of morph a full tilt adds to the timeline */
export const GYRO_NUDGE_SECONDS = 4
/** Per-frame blend toward the tilt target */
export const GYRO_NUDGE_SMOOTH = 0.08
/** Deltas below this are left to the natural clock */
export const GYRO_NUDGE_EPSILON = 0.001

/**
 * One frame of the nudge: where the offset moves to and how many seconds of
 * timeline that step is worth.
 * @param {number} offset Current nudge offset in seconds
 * @param {number} gyro_x Normalized tilt, -1..1
 * @param {number} gyro_y Normalized tilt, -1..1
 * @returns {{ offset: number, delta: number }}
 */
export const nudge_step = (offset, gyro_x, gyro_y) => {
  const magnitude = Math.min(1, Math.hypot(gyro_x, gyro_y))
  const target = magnitude * GYRO_NUDGE_SECONDS
  const next = offset + (target - offset) * GYRO_NUDGE_SMOOTH
  return { offset: next, delta: next - offset }
}
