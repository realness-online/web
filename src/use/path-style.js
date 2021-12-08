import { useActiveElement } from '@vueuse/core'
import { change } from '@/use/opacity'

export const svg_ns = 'http://www.w3.org/2000/svg'

export function itemprop_query(name) {
  return document.querySelector(`[itemprop="${name}"]`)
}
export function create_path_element() {
  return document.createElementNS(svg_ns, 'path')
}

export function fill_opacity(direction, resolution) {
  const path = useActiveElement().value
  path.style.fillOpacity = change(path.style.fillOpacity, direction, resolution)
}

export function stroke_opacity(direction, resolution) {
  const path = useActiveElement().value
  path.style.strokeOpacity = change(
    path.style.strokeOpacity,
    direction,
    resolution
  )
}

export function opacity(direction, resolution) {
  const path = useActiveElement().value
  path.style.opacity = change(path.style.opacity, direction, resolution)
}
