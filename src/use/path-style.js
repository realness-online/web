import { useActiveElement } from '@vueuse/core'
import { change } from '@/use/opacity'

export const svg_ns = 'http://www.w3.org/2000/svg'

export function itemprop_query(name) {
  return document.querySelector(`[itemprop="${name}"]`)
}
export function create_path_element() {
  return document.createElementNS(svg_ns, 'path')
}

export function fill_opacity(resolution) {
  const path = useActiveElement().value
  path.style.fillOpacity = change(path.style.fillOpacity, resolution)
}

export function stroke_opacity(resolution) {
  const path = useActiveElement().value
  path.style.strokeOpacity = change(path.style.strokeOpacity, resolution)
}

export function opacity(resolution) {
  const path = useActiveElement().value
  path.style.opacity = change(path.style.opacity, resolution)
}
