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
 * @param {string | undefined} viewbox
 * @returns {boolean}
 */
export const poster_landscape = viewbox => {
  if (!viewbox) return false
  const numbers = viewbox.split(' ')
  const width = parseInt(numbers[2], 10)
  const height = parseInt(numbers[3], 10)
  return width > height
}

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
