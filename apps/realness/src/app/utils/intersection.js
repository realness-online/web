/** Sub-pixel slack for intersection ratio comparisons. */
const RATIO_EPSILON = 0.001
const INTERSECTION_STEPS = 100

/** Fire on each 1% visibility change so scroll-in posters can reach fully visible. */
export const INTERSECTION_THRESHOLDS = Array.from(
  { length: INTERSECTION_STEPS + 1 },
  (_, index) => index / INTERSECTION_STEPS
)

/** @returns {DOMRectReadOnly} */
const viewport_rect = () => {
  const width = globalThis.innerWidth ?? 0
  const height = globalThis.innerHeight ?? 0
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height
    })
  }
  return rect
}

/**
 * @param {DOMRectReadOnly} element_rect
 * @param {DOMRectReadOnly} root_rect
 */
export const intersection_ratio = (element_rect, root_rect) => {
  const left = Math.max(element_rect.left, root_rect.left)
  const top = Math.max(element_rect.top, root_rect.top)
  const right = Math.min(element_rect.right, root_rect.right)
  const bottom = Math.min(element_rect.bottom, root_rect.bottom)
  const visible_width = Math.max(0, right - left)
  const visible_height = Math.max(0, bottom - top)
  const element_area = element_rect.width * element_rect.height
  if (element_area <= 0) return 0
  return (visible_width * visible_height) / element_area
}

/**
 * A third of what can fit is enough to count as watching it. Demanding every
 * pixel meant a poster resting a few pixels off - a storytelling slide the
 * scroll never landed exactly on - kept animation, morph, and 3d switched off.
 */
const VISIBLE_FRACTION = 1 / 3

/**
 * @param {number} ratio
 * @param {DOMRectReadOnly} element_rect
 * @param {DOMRectReadOnly} root_rect
 */
export const is_ratio_visible_enough = (ratio, element_rect, root_rect) => {
  if (ratio <= 0) return false
  if (ratio >= 1) return true

  const max_ratio = Math.min(
    1,
    root_rect.width / element_rect.width,
    root_rect.height / element_rect.height
  )

  return ratio >= max_ratio * VISIBLE_FRACTION - RATIO_EPSILON
}

/**
 * Visible fraction along one scroll axis, normalized so 1 means as much as can
 * fit in the root is showing (the same normalization used above).
 * @param {number} visible_span
 * @param {number} element_span
 * @param {number} root_span
 */
export const axis_visibility = (visible_span, element_span, root_span) => {
  const fit = Math.min(element_span, root_span)
  if (fit <= 0) return 0
  return visible_span / fit
}

/** True when enough of the element is visible to treat it as being watched. */
export const measure_visible_enough = element =>
  measure_visibility(element).in_view

/**
 * @param {Element} element
 * @returns {{ intersecting: boolean, in_view: boolean }}
 */
export const measure_visibility = element => {
  if (!element?.getBoundingClientRect)
    return { intersecting: false, in_view: false }
  const element_rect = element.getBoundingClientRect()
  const root_rect = viewport_rect()
  const ratio = intersection_ratio(element_rect, root_rect)
  return {
    intersecting: ratio > 0,
    in_view: is_ratio_visible_enough(ratio, element_rect, root_rect)
  }
}
