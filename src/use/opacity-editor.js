import { get_path_element } from '@/use/color-editor'
export function fill_more() {
  change_opacity()
}
export function fill_less() {
  change_opacity('less')
}
export function fill_less_subtle() {
  change_opacity('less', 'fill', 0.01)
}
export function fill_more_subtle() {
  change_opacity('less', 'fill', 0.01)
}
export default function change_opacity(direction = 'more', type = 'fill', resolution = 0.025) {
  if (!document.activeElement) return
  const id = document.activeElement.getAttribute('href').substring(1)
  const path = get_path_element(id)
  if (path) {
    let opacity = path.getAttribute(`${type}-opacity`)
    if (!opacity || opacity === 'NaN') opacity = 0.5
    opacity = parseFloat(opacity)
    opacity = opacity * 10000
    opacity = Math.round(opacity)
    opacity = opacity / 10000

    if (direction === 'less') opacity += resolution
    else opacity -= resolution

    if (opacity > 0.9) opacity = 0.8
    else if (opacity < 0) opacity = 0.025

    path.setAttribute(`${type}-opacity`, opacity)
  }
}
