import { change_by } from '@/use/path'

const DEFAULT_OPACITY = 0.025
const OPACITY_PRECISION = 10000
const MAX_OPACITY = 0.9

export function change(opacity = DEFAULT_OPACITY, resolution = change_by) {
  let value = parseFloat(opacity)

  value = value * OPACITY_PRECISION
  value = Math.round(value)
  value = value / OPACITY_PRECISION

  value += resolution

  if (value > 1) value = MAX_OPACITY
  else if (value < 0) value = DEFAULT_OPACITY

  return value
}
