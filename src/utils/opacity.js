import { change_by } from '@/use/path'
export function change(opacity = 0.025, resolution = change_by) {
  let value = parseFloat(opacity)

  value = value * 10000
  value = Math.round(value)
  value = value / 10000

  value += resolution

  if (value > 1) value = 0.9
  else if (value < 0) value = 0.025

  return value
}
