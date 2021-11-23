export const layers_like_fonts = ['light', 'regular', 'bold']
export const svg_ns = 'http://www.w3.org/2000/svg'

import { change } from '@/use/opacity'

export function get_active_id() {
  if (!document.activeElement) return
  return document.activeElement.getAttribute('href').substring(1)
}

export function create_path_element() {
  return document.createElementNS(svg_ns, 'path')
}

export function fill_opacity(direction = 'more', resolution = 0.025) {
  const path = document.getElementById(get_active_id())
  let opacity = path.getAttribute('fill-opacity') // this will come from legacy posters
  if (!opacity) opacity = path.style.fillOpacity
  path.style.fillOpacity = change(opacity, direction, resolution)
}

export function stroke_opacity(direction = 'more', resolution = 0.025) {
  const path = document.getElementById(get_active_id())
  path.style.strokeOpacity = change(
    path.style.strokeOpacity,
    direction,
    resolution
  )
}

export function opacity(direction = 'more', resolution = 0.025) {
  const path = document.getElementById(get_active_id())
  path.style.opacity = change(path.style.opacity, direction, resolution)
}
