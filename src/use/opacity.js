export function change(opacity = 0.5, direction = 'more', resolution = 0.025) {
  if (typeof opacity != 'number') opacity = 0.5
  opacity = parseFloat(opacity)
  opacity = opacity * 10000
  opacity = Math.round(opacity)
  opacity = opacity / 10000

  if (direction === 'less') opacity += resolution
  else opacity -= resolution

  if (opacity > 0.9) opacity = 0.8
  else if (opacity < 0) opacity = 0.025
  return opacity
}
