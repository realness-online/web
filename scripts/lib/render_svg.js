import { create_path_element } from '@/use/path'
import { create_gradients } from './render_gradients'
import { create_masks } from './render_masks'

const create_svg = (vector, options = {}) => {
  const {
    emboss = false,
    animate = false,
    light = false
  } = options

  // Helper for creating element with attributes
  const create_element = (tag, attrs = {}) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    return el
  }

  // Create main SVG element
  const svg = create_element('svg', {
    viewBox: vector.viewbox,
    preserveAspectRatio: 'xMidYMid meet',
    itemtype: '/posters',
    itemid: vector.id
  })

  // Create defs section
  const defs = create_element('defs', { class: 'graphic' })
  svg.appendChild(defs)

  // Create pattern
  const pattern = create_element('pattern', {
    id: `pattern-${vector.id}`,
    width: vector.width,
    height: vector.height,
    viewBox: vector.viewbox,
    patternUnits: 'userSpaceOnUse',
    preserveAspectRatio: 'xMidYMid meet'
  })
  defs.appendChild(pattern)

  // Add background
  const background = create_element('rect', {
    id: `background-${vector.id}`,
    width: vector.width,
    height: vector.height,
    'fill-opacity': '1',
    fill: `url(#radial-background-${vector.id})`
  })
  pattern.appendChild(background)

  // Add paths with masks
  if (vector.light) {
    const path = create_path_element()
    path.setAttribute('d', vector.light.d)
    path.setAttribute('id', `light-${vector.id}`)
    path.setAttribute('mask', `url(#horizontal-mask-${vector.id})`)
    path.setAttribute('fill', `url(#vertical-light-${vector.id})`)
    path.style.fillRule = 'evenodd'
    pattern.appendChild(path)
  }

  if (vector.regular) {
    const path = create_path_element()
    path.setAttribute('d', vector.regular.d)
    path.setAttribute('id', `regular-${vector.id}`)
    path.setAttribute('mask', `url(#radial-mask-${vector.id})`)
    path.setAttribute('fill', `url(#horizontal-regular-${vector.id})`)
    path.style.fillRule = 'evenodd'
    pattern.appendChild(path)
  }

  if (vector.medium) {
    const path = create_path_element()
    path.setAttribute('d', vector.medium.d)
    path.setAttribute('id', `medium-${vector.id}`)
    path.setAttribute('mask', `url(#vertical-mask-${vector.id})`)
    path.setAttribute('fill', `url(#vertical-medium-${vector.id})`)
    path.style.fillRule = 'evenodd'
    pattern.appendChild(path)
  }

  if (vector.bold) {
    const path = create_path_element()
    path.setAttribute('d', vector.bold.d)
    path.setAttribute('id', `bold-${vector.id}`)
    path.setAttribute('mask', `url(#horizontal-mask-${vector.id})`)
    path.setAttribute('fill', `url(#vertical-bold-${vector.id})`)
    path.style.fillRule = 'evenodd'
    pattern.appendChild(path)
  }

  // Add gradients and masks
  if (vector.gradients) {
    defs.appendChild(create_gradients(vector))
    defs.appendChild(create_masks(vector))
  }

  // Add use element for pattern
  const use = create_element('use', {
    href: `#pattern-${vector.id}`
  })
  svg.appendChild(use)

  return svg.outerHTML
}

export { create_svg }
