import css_var from '@/utils/css-var'
import { rgb_to_hex, hsl_to_hex, hsl_to_oklch } from '@/utils/color-converters'

// Color space constants
const RGB_MAX = 255
const PERCENTAGE_MAX = 100
const HUE_GREEN = 180
const HUE_FULL_CIRCLE = 360
const HEX_COLOR_LENGTH = 9
const HEX_COLOR_LENGTH_NO_ALPHA = 7
const HEX_ALPHA_LENGTH = 2
const HEX_CHAR_LENGTH = 4
const HEX_FULL_LENGTH = 7
const HUE_WRAP_DIVISOR = 6
const HUE_OFFSET_BLUE = 4
const HUE_DEGREES_PER_SEGMENT = 60

// Hex string indices for #RRGGBB format
const HEX_RED_START = 1
const HEX_RED_END = 2
const HEX_GREEN_START = 3
const HEX_GREEN_END = 4
const HEX_BLUE_START = 5
const HEX_BLUE_END = 6

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

  if (hex && hex.length === HEX_COLOR_LENGTH)
    return hex.slice(0, -HEX_ALPHA_LENGTH)
  else if (hex && hex.length === HEX_COLOR_LENGTH_NO_ALPHA) return hex
  throw `Provided color is unrecognized — ${color}`
}
export const to_hex_number = color => parseInt(color.substring(1))

export const to_hsla = (color = '') => {
  let H = color.toString()
  // check if it's already hsl
  if (H.startsWith('hsl')) H = hsl_to_hex(H)

  if (H.startsWith('rgb')) H = `#${rgb_to_hex(H)}`
  // Convert hex to RGB first
  let r = 0
  let g = 0
  let b = 0
  if (H.length === HEX_CHAR_LENGTH) {
    r = parseInt(`0x${H[1]}${H[1]}`)
    g = parseInt(`0x${H[2]}${H[2]}`)
    b = parseInt(`0x${H[3]}${H[3]}`)
  } else if (H.length === HEX_FULL_LENGTH) {
    // todo accomidate hex with alpha
    r = parseInt(`0x${H[HEX_RED_START]}${H[HEX_RED_END]}`)
    g = parseInt(`0x${H[HEX_GREEN_START]}${H[HEX_GREEN_END]}`)
    b = parseInt(`0x${H[HEX_BLUE_START]}${H[HEX_BLUE_END]}`)
  }
  return rgba_to_hsla({ r, g, b, a: RGB_MAX })
}
export const to_complimentary_hsl = (color = '') => {
  const hsl = to_hsla(color)
  const h = hsl.h + HUE_GREEN
  const s = PERCENTAGE_MAX - hsl.s
  const l = PERCENTAGE_MAX - hsl.l
  return color_to_hsla({ h, s, l, a: hsl.a })
}
export const luminosity = (color, change_by) => {
  const hsl = to_hsla(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return color_to_hsla({ h: hsl.h, s: hsl.s, l, a: hsl.a })
}

export const rgba_to_hsla = ({ r, g, b, a }) => {
  // Then to HSL
  const red = r / RGB_MAX
  const green = g / RGB_MAX
  const blue = b / RGB_MAX
  const alpha_normalized = a / RGB_MAX
  const alpha = alpha_normalized.toFixed(2)
  const cmin = Math.min(red, green, blue)
  const cmax = Math.max(red, green, blue)
  const delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  const HUE_GREEN_OFFSET = 2
  if (delta === 0) h = 0
  else if (cmax === red) h = ((green - blue) / delta) % HUE_WRAP_DIVISOR
  else if (cmax === green) h = (blue - red) / delta + HUE_GREEN_OFFSET
  else h = (red - green) / delta + HUE_OFFSET_BLUE

  h = Math.round(h * HUE_DEGREES_PER_SEGMENT)

  if (h < 0) h += HUE_FULL_CIRCLE

  l = (cmax + cmin) / 2
  l = +(l * PERCENTAGE_MAX).toFixed(2)

  s = delta === 0 ? 0 : delta / (1 + Math.abs(2 * l - 1))
  s = Math.abs(s)

  const PERCENTAGE_PRECISION = 10000
  const s_fixed = (s * PERCENTAGE_PRECISION).toFixed(2)

  s = Math.round(parseFloat(s_fixed))
  l = Math.round(l)

  return color_to_hsla({ h, s, l, a: alpha })
}
export const hsla_to_color = hsla => {
  const color_string = hsla.substring(5, hsla.length - 1)
  const [h_val, s_val, l_val, a_val] = color_string.split(', ')
  const h = h_val
  const s = s_val.replace('%', '')
  const l = l_val.replace('%', '')
  const a = a_val
  const color = { h, s, l, a }
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
