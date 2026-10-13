/**
 * Fill props with SVG viewBox-derived dimensions (shared by item parsing and poster code).
 * @param {Record<string, unknown>} props
 * @param {Element} item
 */
export const set_vector_dimensions = (props, item) => {
  const viewbox = item.getAttribute('viewBox') ?? ''
  props.viewbox = viewbox
  const [, , default_width, default_height] = viewbox.split(' ')
  let width = item.getAttribute('width')
  let height = item.getAttribute('height')
  if (!width) width = default_width
  if (!height) height = default_height
  props.width = width
  props.height = height
}
