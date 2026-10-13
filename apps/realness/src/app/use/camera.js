import { computed, reactive } from 'vue'

/** How far one press travels, in frames of the poster. */
export const CAMERA_STEP = 0.1
/** Far enough to cross a tall poster, near enough to stay recoverable. */
export const CAMERA_LIMIT = 1.5
/** Held-key repeats arrive about this often. */
export const CAMERA_REPEAT_MS = 260
/** How much a held key gains per repeat, and where the gain stops. */
export const CAMERA_RAMP = 1.12
export const CAMERA_RAMP_MAX = 1.7

/**
 * How far the posters currently on screen can actually travel, in frames.
 *
 * One camera serves every poster, so without this the count keeps rising past
 * what a short poster can use, and the presses back out of it do nothing until
 * the surplus is spent. Each poster reports its own reach while it is visible;
 * the camera stops at the most generous one.
 *
 * @type {Map<string, { up: number, down: number }>}
 */
const reaches = reactive(new Map())

/**
 * @param {string} id
 * @param {{ up: number, down: number } | null} reach Null forgets the poster
 */
export const report_camera_reach = (id, reach) => {
  if (reach) reaches.set(id, reach)
  else reaches.delete(id)
}

export const camera_reach = computed(() => {
  if (!reaches.size) return { up: CAMERA_LIMIT, down: CAMERA_LIMIT }
  let up = 0
  let down = 0
  for (const reach of reaches.values()) {
    up = Math.max(up, reach.up)
    down = Math.max(down, reach.down)
  }
  return { up, down }
})

/**
 * One press of an arrow key.
 *
 * Holding it picks up speed like a dolly leaving its mark, but only so far -
 * past a point it stops reading as a camera and starts reading as a jump cut.
 * A pause, or a change of direction, puts it back at walking pace.
 *
 * @param {Object} press
 * @param {number} press.at Where the camera is now, in frames from centre
 * @param {number} press.direction -1 up the poster, 1 down
 * @param {number} press.ramp Speed carried in from the last press
 * @param {boolean} press.held Whether this press continues a held key
 * @param {{ up: number, down: number }} [press.reach] What the posters on
 *   screen can use
 * @returns {{ at: number, ramp: number }}
 */
export const camera_next = ({
  at,
  direction,
  ramp,
  held,
  reach = { up: CAMERA_LIMIT, down: CAMERA_LIMIT }
}) => {
  const next_ramp = held ? Math.min(CAMERA_RAMP_MAX, ramp * CAMERA_RAMP) : 1
  const wanted = at + direction * CAMERA_STEP * next_ramp
  const up = Math.min(CAMERA_LIMIT, reach.up)
  const down = Math.min(CAMERA_LIMIT, reach.down)
  return { at: Math.min(down, Math.max(-up, wanted)), ramp: next_ramp }
}
