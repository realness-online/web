import css_var from '@/utils/css-var'
import { rgb_to_hex, hsl_to_hex, hsl_to_oklch } from '@/utils/color-converters'

export const to_hex = (color = '', green, blue) => {
  // Handle individual RGB values
  if (
    typeof color === 'number' &&
    typeof green === 'number' &&
    typeof blue === 'number'
  )
    return rgb_to_hex(color, green, blue)

  // Handle string inputs
  if (typeof color !== 'string')
    throw `Provided color is unrecognized — ${color}`

  let color_value = color
  if (color_value.length === 0) color_value = '--black-dark'
  if (color_value.startsWith('--')) color_value = css_var(color_value).trim()
  if (color_value.startsWith('#')) return color_value

  let hex
  if (color_value.startsWith('rgb')) hex = rgb_to_hex(color_value)
  else if (color_value.startsWith('hsl')) hex = hsl_to_hex(color_value)
  else {
    // Try to parse as individual RGB values
    const parts = color_value.toString().split(',')
    if (parts.length === 3) {
      const r = parseInt(parts[0].trim())
      const g = parseInt(parts[1].trim())
      const b = parseInt(parts[2].trim())
      hex = rgb_to_hex(r, g, b)
    } else throw `Provided color is unrecognized — ${color}`
  }

  if (hex && hex.length === 9) return hex.slice(0, -2)
  else if (hex && hex.length === 7) return hex
  throw `Provided color is unrecognized — ${color}`
}
export const to_hex_number = color => parseInt(color.substring(1))

export const to_hsla = (color = '') => {
  let H = color.toString()
  // check if it's already hsl
  if (H.startsWith('hsl')) return (H = hsl_to_hex(H))
  if (H.startsWith('rgb')) H = `#${rgb_to_hex(H)}`
  // Convert hex to RGB first
  let r = 0
  let g = 0
  let b = 0
  if (H.length === 4) {
    r = `0x${H[1]}${H[1]}`
    g = `0x${H[2]}${H[2]}`
    b = `0x${H[3]}${H[3]}`
  } else if (H.length === 7) {
    // todo accomidate hex with alpha
    r = `0x${H[1]}${H[2]}`
    g = `0x${H[3]}${H[4]}`
    b = `0x${H[5]}${H[6]}`
  }
  return rgba_to_hsla({ r, g, b, a: 255 })
}
export const to_complimentary_hsl = (color = '') => {
  const hsl = to_hsla(color)
  const h = hsl.h + 180
  const s = 100 - hsl.s
  const l = 100 - hsl.l
  return color_to_hsla({ h, s, l, a: hsl.a })
}
export const luminosity = (color, change_by) => {
  const hsl = to_hsla(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return color_to_hsla({ h: hsl.h, s: hsl.s, l, a: hsl.a })
}

export const rgba_to_hsla = ({ r, g, b, a }) => {
  // Then to HSL
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const alpha_normalized = a / 255
  const alpha = alpha_normalized.toFixed(2)
  const cmin = Math.min(red, green, blue)
  const cmax = Math.max(red, green, blue)
  const delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  if (delta === 0) h = 0
  else if (cmax === red) h = ((green - blue) / delta) % 6
  else if (cmax === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4

  h = Math.round(h * 60)

  if (h < 0) h += 360

  l = (cmax + cmin) / 2
  l = +(l * 100).toFixed(2)

  s = delta === 0 ? 0 : delta / (1 + Math.abs(2 * l - 1))
  s = Math.abs(s)

  s = (s * 10000).toFixed(2)

  s = Math.round(s)
  l = Math.round(l)

  return color_to_hsla({ h, s, l, a: alpha })
}
export const hsla_to_color = hsla => {
  let color = hsla.substring(5, hsla.length - 1)
  color = color.split(', ')
  const h = color[0]
  const s = color[1].replace('%', '')
  const l = color[2].replace('%', '')
  const a = color[3]
  color = { h, s, l, a }
  return color_to_hsla(color)
}
export const color_to_hsla = ({ h, s, l, a }) => {
  const hsla = `hsla(${h}, ${s}%, ${l}%, ${a})`
  const ok = hsl_to_oklch(h, s, l)
  ok.h = Math.round(ok.h)
  ok.l = ok.l.toFixed(3)
  ok.c = ok.c.toFixed(3)
  return {
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsla,
    oklch: `oklch(${ok.l}, ${ok.c}, ${ok.h})`,
    h,
    s,
    l,
    a
  }
}

// https://una.im/css-color-theming
// 100% saturation is completely saturated (full color),
// while 0% is unsaturated (gray), 50% is normal
// 100% lightness is white,
// 50% is normal
// 0% lightness is black
