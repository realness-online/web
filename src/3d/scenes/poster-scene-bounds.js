import * as THREE from 'three'

export const VIEW_BOUNDS_MARGIN = 0.02

const QUAD_CORNER_COUNT = 4
const BINARY_SEARCH_STEPS = 12

const corner = new THREE.Vector3()
const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const scale = new THREE.Vector3(1, 1, 1)
const euler = new THREE.Euler(0, 0, 0, 'XYZ')
const ndc_corners = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 }
]

/**
 * @param {number} x
 * @param {number} y
 * @param {{ x: number, y: number }[]} quad
 */
const point_in_convex_quad = (x, y, quad) => {
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

  let has_pos = false
  let has_neg = false
  for (let i = 0; i < QUAD_CORNER_COUNT; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % QUAD_CORNER_COUNT]
    const s = cross(a, b, { x, y })
    if (s > 0) has_pos = true
    if (s < 0) has_neg = true
    if (has_pos && has_neg) return false
  }
  return true
}

/**
 * @param {object} view
 * @param {THREE.PerspectiveCamera} view.camera
 * @param {number} view.plane_w
 * @param {number} view.plane_h
 * @param {{ x: number, y: number }} view.pan
 * @param {number} view.zoom_z
 * @param {{ x: number, y: number }} view.tilt
 * @returns {{ min_x: number, max_x: number, min_y: number, max_y: number, corners: { x: number, y: number }[] } | null}
 */
export const get_poster_ndc_bounds = ({
  camera,
  plane_w,
  plane_h,
  pan,
  zoom_z,
  tilt
}) => {
  if (!camera) return null

  position.set(pan.x, pan.y, zoom_z)
  euler.set(tilt.x, tilt.y, 0)
  quaternion.setFromEuler(euler)
  matrix.compose(position, quaternion, scale)

  const hw = plane_w / 2
  const hh = plane_h / 2
  let min_x = Infinity
  let max_x = -Infinity
  let min_y = Infinity
  let max_y = -Infinity

  for (let i = 0; i < QUAD_CORNER_COUNT; i++) {
    const lx = i === 0 || i === 3 ? -hw : hw
    const ly = i < 2 ? -hh : hh
    corner.set(lx, ly, 0).applyMatrix4(matrix).project(camera)
    ndc_corners[i].x = corner.x
    ndc_corners[i].y = corner.y
    min_x = Math.min(min_x, corner.x)
    max_x = Math.max(max_x, corner.x)
    min_y = Math.min(min_y, corner.y)
    max_y = Math.max(max_y, corner.y)
  }

  return {
    min_x,
    max_x,
    min_y,
    max_y,
    corners: ndc_corners.map(c => ({ x: c.x, y: c.y }))
  }
}

/**
 * @param {{ min_x: number, max_x: number, min_y: number, max_y: number, corners: { x: number, y: number }[] } | null} bounds
 * @param {number} [margin]
 */
export const ndc_bounds_in_view = (bounds, margin = VIEW_BOUNDS_MARGIN) => {
  if (!bounds) return true
  const limit = 1 - margin
  return (
    bounds.min_x >= -limit &&
    bounds.max_x <= limit &&
    bounds.min_y >= -limit &&
    bounds.max_y <= limit
  )
}

/**
 * Zoomed in: keep the viewport inside the poster quad.
 * Zoomed out: keep the poster axis-aligned bounds inside the viewport.
 *
 * @param {{ min_x: number, max_x: number, min_y: number, max_y: number, corners: { x: number, y: number }[] } | null} bounds
 * @param {number} [margin]
 */
export const poster_covers_viewport = (bounds, margin = VIEW_BOUNDS_MARGIN) => {
  if (!bounds) return true

  const limit = 1 - margin
  const zoomed_in =
    bounds.min_x < -limit ||
    bounds.max_x > limit ||
    bounds.min_y < -limit ||
    bounds.max_y > limit

  if (zoomed_in) {
    const viewport = [
      [-limit, -limit],
      [limit, -limit],
      [limit, limit],
      [-limit, limit]
    ]
    return viewport.every(([x, y]) =>
      point_in_convex_quad(x, y, bounds.corners)
    )
  }

  return ndc_bounds_in_view(bounds, margin)
}

/**
 * @param {object} view
 * @param {THREE.PerspectiveCamera} view.camera
 * @param {number} view.plane_w
 * @param {number} view.plane_h
 * @param {{ x: number, y: number }} view.pan
 * @param {number} view.zoom_z
 * @param {{ x: number, y: number }} view.tilt
 */
const poster_view_is_valid = view =>
  poster_covers_viewport(get_poster_ndc_bounds(view))

/**
 * @param {object} view
 * @param {THREE.PerspectiveCamera} view.camera
 * @param {number} view.plane_w
 * @param {number} view.plane_h
 * @param {{ x: number, y: number }} view.pan
 * @param {number} view.zoom_z
 * @param {{ x: number, y: number }} view.tilt
 */
export const clamp_pan_to_bounds = ({
  camera,
  plane_w,
  plane_h,
  pan,
  zoom_z,
  tilt
}) => {
  if (!camera) return

  const target_x = pan.x
  const target_y = pan.y
  const try_pan = scale => ({
    x: target_x * scale,
    y: target_y * scale
  })

  const fits = scale =>
    poster_view_is_valid({
      camera,
      plane_w,
      plane_h,
      pan: try_pan(scale),
      zoom_z,
      tilt
    })

  if (fits(1)) return

  let lo = 0
  let hi = 1
  for (let i = 0; i < BINARY_SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }

  pan.x = target_x * lo
  pan.y = target_y * lo
}

/**
 * @param {object} view
 * @param {THREE.PerspectiveCamera} view.camera
 * @param {number} view.plane_w
 * @param {number} view.plane_h
 * @param {{ x: number, y: number }} view.pan
 * @param {number} view.zoom_z
 * @param {{ x: number, y: number }} view.current_tilt
 * @param {number} view.target_tilt_x
 * @param {number} view.target_tilt_y
 */
export const clamp_tilt_target_to_bounds = ({
  camera,
  plane_w,
  plane_h,
  pan,
  zoom_z,
  current_tilt,
  target_tilt_x,
  target_tilt_y
}) => {
  if (!camera) return { x: target_tilt_x, y: target_tilt_y }

  const try_blend = blend => ({
    x: current_tilt.x + (target_tilt_x - current_tilt.x) * blend,
    y: current_tilt.y + (target_tilt_y - current_tilt.y) * blend
  })

  const fits = blend =>
    poster_view_is_valid({
      camera,
      plane_w,
      plane_h,
      pan,
      zoom_z,
      tilt: try_blend(blend)
    })

  if (fits(1)) return { x: target_tilt_x, y: target_tilt_y }

  let lo = 0
  let hi = 1
  for (let i = 0; i < BINARY_SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }

  return try_blend(lo)
}

/**
 * @param {object} view
 * @param {THREE.PerspectiveCamera} view.camera
 * @param {number} view.plane_w
 * @param {number} view.plane_h
 * @param {{ x: number, y: number }} view.pan
 * @param {number} view.zoom_z
 * @param {{ x: number, y: number }} view.tilt
 */
export const clamp_tilt_values_to_bounds = ({
  camera,
  plane_w,
  plane_h,
  pan,
  zoom_z,
  tilt
}) =>
  clamp_tilt_target_to_bounds({
    camera,
    plane_w,
    plane_h,
    pan,
    zoom_z,
    current_tilt: { x: 0, y: 0 },
    target_tilt_x: tilt.x,
    target_tilt_y: tilt.y
  })

/**
 * @param {object} options
 * @param {() => THREE.PerspectiveCamera | null} options.get_camera
 * @param {number} options.plane_w
 * @param {number} options.plane_h
 * @param {{ target: { x: number, y: number }, current: { x: number, y: number } }} options.pan
 * @param {number} options.zoom_z
 * @param {{ x: number, y: number }} options.tilt
 * @param {boolean} [options.snap_pan]
 */
export const enforce_poster_view_bounds = ({
  get_camera,
  plane_w,
  plane_h,
  pan,
  zoom_z,
  tilt,
  snap_pan = false
}) => {
  const camera = get_camera()
  if (!camera) return

  const view = { camera, plane_w, plane_h, zoom_z, tilt }
  clamp_pan_to_bounds({ ...view, pan: pan.target })
  clamp_pan_to_bounds({ ...view, pan: pan.current })

  if (snap_pan) {
    pan.current.x = pan.target.x
    pan.current.y = pan.target.y
  }

  const clamped = clamp_tilt_values_to_bounds({
    ...view,
    pan: pan.current
  })
  tilt.x = clamped.x
  tilt.y = clamped.y
}
