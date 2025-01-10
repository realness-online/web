const create_gradient = (id, stops, options = {}) => {
  const {
    type = 'linearGradient',
    x1 = '0%',
    y1 = '0%',
    x2 = '100%',
    y2 = '100%',
    cx = '50%',
    cy = '50%',
    r = '50%'
  } = options

  const gradient = document.createElementNS('http://www.w3.org/2000/svg', type)
  gradient.setAttribute('id', id)

  if (type === 'linearGradient') {
    gradient.setAttribute('x1', x1)
    gradient.setAttribute('y1', y1)
    gradient.setAttribute('x2', x2)
    gradient.setAttribute('y2', y2)
  } else if (type === 'radialGradient') {
    gradient.setAttribute('cx', cx)
    gradient.setAttribute('cy', cy)
    gradient.setAttribute('r', r)
  }

  stops.forEach(stop => {
    const stop_el = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop_el.setAttribute('offset', stop.offset)
    stop_el.setAttribute('stop-color', stop.color)
    if (stop.opacity) stop_el.setAttribute('stop-opacity', stop.opacity)

    gradient.appendChild(stop_el)
  })

  return gradient
}

const create_gradients = vector => {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  defs.setAttribute('class', 'gradients')

  // Background gradients
  const radial_background = create_gradient(
    `radial-background-${vector.id}`,
    [
      { offset: '0%', color: vector.gradients.background[0] },
      { offset: '100%', color: vector.gradients.background[1] }
    ],
    {
      type: 'radialGradient',
      cx: '50%',
      cy: '0%',
      r: '100%'
    }
  )
  defs.appendChild(radial_background)

  // Weight gradients (light, regular, medium, bold)
  const weights = ['light', 'regular', 'medium', 'bold']
  const directions = ['vertical', 'horizontal', 'radial']

  weights.forEach(weight => {
    if (!vector.gradients[weight]) return

    directions.forEach(direction => {
      const gradient_id = `${direction}-${weight}-${vector.id}`
      const gradient_type =
        direction === 'radial' ? 'radialGradient' : 'linearGradient'
      const options = {
        type: gradient_type,
        ...get_gradient_direction(direction)
      }

      const gradient = create_gradient(
        gradient_id,
        [
          { offset: '0%', color: vector.gradients[weight][0] },
          { offset: '100%', color: vector.gradients[weight][1] }
        ],
        options
      )

      defs.appendChild(gradient)
    })
  })

  return defs
}

const get_gradient_direction = direction => {
  switch (direction) {
    case 'vertical':
      return { x1: '0%', y1: '0%', x2: '0%', y2: '100%' }
    case 'horizontal':
      return { x1: '0%', y1: '0%', x2: '100%', y2: '0%' }
    case 'radial':
      return { cx: '50%', cy: '50%', r: '50%' }
    default:
      return {}
  }
}

export { create_gradients }
