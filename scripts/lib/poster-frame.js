/**
 * Why a rendered poster frame cannot be kept, or null when it is usable.
 *
 * A poster whose symbol defs never mounted still exports a well-formed png and
 * svg - just an empty shell, with `use` hrefs pointing at symbols that were
 * never merged in. Traced paths are the proof the frame is real, so a pathless
 * frame is a failed render and not a frame to write.
 *
 * @param {{ png?: string, svg?: string }} [frame]
 * @returns {string | null}
 */
export const frame_problem = ({ png, svg } = {}) => {
  if (!png) return 'produced no poster png'
  if (!svg) return 'produced no poster svg'
  if (!svg.includes('<path')) return 'traced no paths'
  return null
}

/**
 * The pixel size to rasterize a traced poster at. The svg is the master and
 * has no resolution of its own, so `target_width` picks any size off the same
 * geometry; zero keeps the width it was traced at.
 *
 * Dimensions come back even - libx264 with yuv420p rejects odd ones, and
 * rounding here beats padding a stray line of pixels on at encode time.
 *
 * @param {string} svg
 * @param {number} [target_width]
 * @returns {{ width: number, height: number } | null}
 */
export const poster_raster_size = (svg, target_width = 0) => {
  const viewbox = /viewBox="([^"]+)"/.exec(svg ?? '')?.[1]
  if (!viewbox) return null
  const [, , traced_width, traced_height] = viewbox
    .trim()
    .split(/\s+/)
    .map(Number)
  if (!(traced_width > 0) || !(traced_height > 0)) return null
  const even = value => Math.round(value / 2) * 2
  const width = even(target_width > 0 ? target_width : traced_width)
  return { width, height: even((width * traced_height) / traced_width) }
}
