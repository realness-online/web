const create_masks = vector => {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  defs.setAttribute('class', 'masks')

  // Create mask directions
  const directions = ['horizontal', 'vertical', 'radial']
  directions.forEach(direction => {
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask')
    mask.setAttribute('id', `${direction}-mask-${vector.id}`)

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '100%')
    rect.setAttribute('height', '100%')
    rect.setAttribute('fill', `url(#${direction}-gradient-${vector.id})`)

    mask.appendChild(rect)
    defs.appendChild(mask)

    // Create corresponding gradient for mask
    const gradient = document.createElementNS(
      'http://www.w3.org/2000/svg',
      direction === 'radial' ? 'radialGradient' : 'linearGradient'
    )
    gradient.setAttribute('id', `${direction}-gradient-${vector.id}`)

    if (direction === 'radial') {
      gradient.setAttribute('cx', '50%')
      gradient.setAttribute('cy', '50%')
      gradient.setAttribute('r', '50%')
    } else {
      const isHorizontal = direction === 'horizontal'
      gradient.setAttribute('x1', isHorizontal ? '0%' : '50%')
      gradient.setAttribute('y1', isHorizontal ? '50%' : '0%')
      gradient.setAttribute('x2', isHorizontal ? '100%' : '50%')
      gradient.setAttribute('y2', isHorizontal ? '50%' : '100%')
    }

    // Add stops
    const stops = [
      { offset: '0%', color: '#fff' },
      { offset: '100%', color: '#000' }
    ]

    stops.forEach(stop => {
      const stop_el = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
      stop_el.setAttribute('offset', stop.offset)
      stop_el.setAttribute('stop-color', stop.color)
      gradient.appendChild(stop_el)
    })

    defs.appendChild(gradient)
  })

  return defs
}

export { create_masks }
