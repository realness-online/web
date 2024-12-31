import { change_by } from '@/use/path'
export function change(opacity = 0.025, resolution = change_by) {
  opacity = parseFloat(opacity)

  opacity = opacity * 10000
  opacity = Math.round(opacity)
  opacity = opacity / 10000

  opacity += resolution

  if (opacity > 1) opacity = 0.9
  else if (opacity < 0) opacity = 0.025

  return opacity
}
