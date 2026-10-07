/**
 * @param {string} [alignment]
 * @returns {string}
 */
export const slice_preserve_aspect_ratio = (alignment = 'ymid') => {
  let y_align = 'Mid'
  if (alignment === 'ymin') y_align = 'Min'
  else if (alignment === 'ymax') y_align = 'Max'
  return `xMidY${y_align} slice`
}

/**
 * The poster's width over its height. 1 when there is no viewBox yet - the
 * silhouette as-svg draws until the poster loads is square.
 *
 * @param {string | undefined} viewbox
 * @returns {number}
 */
export const poster_ratio = viewbox => {
  if (!viewbox) return 1
  const [, , width, height] = viewbox.split(' ').map(Number)
  if (!width || !height) return 1
  return width / height
}

/**
 * @param {string | undefined} viewbox
 * @returns {boolean}
 */
export const poster_landscape = viewbox => poster_ratio(viewbox) > 1

/**
 * @param {{
 *   meet?: boolean,
 *   mode?: string,
 *   alignment?: string
 * }} [options]
 * @returns {string}
 */
export const poster_preserve_aspect_ratio = ({
  meet = false,
  mode,
  alignment = 'ymid'
} = {}) => {
  if (meet) return 'xMidYMid meet'
  if (mode && mode !== 'auto') return slice_preserve_aspect_ratio(alignment)
  return 'xMidYMid meet'
}

/**
 * How far the camera can travel on this poster, in frames, before it runs out
 * of crop. Not symmetric: `alignment` says where slice already put the poster,
 * and a poster held at its top has the whole crop below it and none above.
 *
 * @param {Object} camera
 * @param {number} camera.width Rendered width
 * @param {number} camera.height Rendered height
 * @param {string} [camera.viewbox] The poster's viewBox
 * @param {string} [camera.alignment] slice_alignment: ymin, ymid or ymax
 * @returns {{ up: number, down: number, frame: number }}
 */
export const camera_bounds = ({
  width,
  height,
  viewbox,
  alignment = 'ymid'
}) => {
  const nothing = { up: 0, down: 0, frame: 0 }
  if (!viewbox || !width || !height) return nothing
  const [, , content_width, content_height] = viewbox.split(' ').map(Number)
  if (!content_width || !content_height) return nothing
  const scale = Math.max(width / content_width, height / content_height)
  const frame = height / scale
  const crop = Math.max(0, content_height - frame)

  let up = crop / 2
  let down = crop / 2
  if (alignment === 'ymin') [up, down] = [0, crop]
  else if (alignment === 'ymax') [up, down] = [crop, 0]

  return { up: up / frame, down: down / frame, frame }
}

/**
 * Where the camera sits on this poster, in viewBox units. Positive looks
 * further down the poster.
 *
 * A press moves the same fraction of the frame on every poster, so the gesture
 * feels the same whatever is on screen and a tall poster simply takes more
 * presses to cross. Each poster then stops at its own edge, so a landscape one
 * cannot be pushed past its crop into empty space.
 *
 * @param {Object} camera
 * @param {number} camera.width Rendered width
 * @param {number} camera.height Rendered height
 * @param {string} [camera.viewbox] The poster's viewBox
 * @param {string} [camera.alignment] slice_alignment: ymin, ymid or ymax
 * @param {number} camera.at Frames of travel from centre
 * @returns {number}
 */
export const camera_travel = ({ at, ...poster }) => {
  const { up, down, frame } = camera_bounds(poster)
  if (!frame) return 0
  // + 0 so a clamp to zero never reports -0, which reads oddly downstream.
  return Math.min(down, Math.max(-up, at)) * frame + 0
}
