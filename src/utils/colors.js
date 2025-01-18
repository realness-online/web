import rgb_to_hex from 'rgb-hex'
import hsl_to_hex from 'hsl-to-hex'
import css_var from '@/utils/css-var'
import {
  useMode as use_mode,
  modeHsl as mode_hsl,
  modeOklch as mode_oklch,
  converter
} from 'culori/fn'
use_mode(mode_oklch)
use_mode(mode_hsl)

const degrees_in_circle = 360
const complimentary_hue_offset = 180
const saturation_scale_factor = 10000
const rgb_max_value = 255
const hue_green_offset = 2
const hue_blue_offset = 4
const hex_with_alpha_length = 9
const hex_length = 7
const short_hex_length = 4
const alpha_slice_offset = -2
const hue_red_divisor = 6
const hex_red_index = 1
const hex_green_index = 2
const hex_blue_index = 3
const hue_scale_factor = 60

/**
 * @param {string} input_color
 * @returns {string}
 */
export const to_hex = (input_color = '') => {
  let color = input_color
  if (color.length === 0) color = '--black-dark'
  if (color.startsWith('--')) color = css_var(color).trim()
  if (color.startsWith('#')) return color
  let hex
  if (color.startsWith('rgb')) hex = `#${rgb_to_hex(color)}`
  if (color.startsWith('hsl')) hex = hsl_to_hex(color)
  if (hex.length === hex_with_alpha_length)
    return hex.slice(0, alpha_slice_offset)
  else if (hex.length === hex_length) return hex
  throw `Provided color is unrecognized — ${color}`
}

/**
 * @param {string} color
 * @returns {number}
 */
export const to_hex_number = color => parseInt(color.substring(1))

/**
 * @param {string} color
 * @returns {object}
 */
export const to_hsla = (color = '') => {
  let H = color.toString()
  // check if it's already hsl
  if (H.startsWith('hsl')) return (H = hsl_to_hex(H))
  if (H.startsWith('rgb')) H = `#${rgb_to_hex(H)}`
  // Convert hex to RGB first
  let r = 0
  let g = 0
  let b = 0
  if (H.length === short_hex_length) {
    r = `0x${H[hex_red_index]}${H[hex_red_index]}`
    g = `0x${H[hex_green_index]}${H[hex_green_index]}`
    b = `0x${H[hex_blue_index]}${H[hex_blue_index]}`
  } else if (H.length === hex_length) {
    r = `0x${H[hex_red_index]}${H[hex_red_index + 1]}`
    g = `0x${H[hex_green_index]}${H[hex_green_index + 1]}`
    b = `0x${H[hex_blue_index]}${H[hex_blue_index + 1]}`
  }
  return rgba_to_hsla({ r, g, b, a: 255 })
}

/**
 * @param {string} color
 * @returns {object}
 */
export const to_complimentary_hsl = (color = '') => {
  const hsl = to_hsla(color)
  const h = hsl.h + complimentary_hue_offset
  const s = 100 - hsl.s
  const l = 100 - hsl.l
  return color_to_hsla({ h, s, l, a: hsl.a })
}

/**
 * @param {string} color
 * @param {number} change_by
 * @returns {object}
 */
export const luminosity = (color, change_by) => {
  const hsl = to_hsla(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return color_to_hsla({
    h: hsl.h.toString(),
    s: hsl.s,
    l: l.toString(),
    a: hsl.a
  })
}

/**
 * @param {object} rgba
 * @returns {object}
 */
export const rgba_to_hsla = ({ r, g, b, a }) => {
  // Then to HSL
  const r_norm = r / rgb_max_value
  const g_norm = g / rgb_max_value
  const b_norm = b / rgb_max_value
  a /= rgb_max_value
  a = a.toFixed(2)
  const cmin = Math.min(r_norm, g_norm, b_norm)
  const cmax = Math.max(r_norm, g_norm, b_norm)
  const delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  if (delta === 0) h = 0
  else if (cmax === r) h = ((g - b) / delta) % hue_red_divisor
  else if (cmax === g) h = (b - r) / delta + hue_green_offset
  else h = (r - g) / delta + hue_blue_offset

  h = Math.round(h * hue_scale_factor)

  if (h < 0) h += degrees_in_circle

  l = (cmax + cmin) / 2
  l = +(l * 100).toFixed(2)

  s = delta === 0 ? 0 : delta / (1 + Math.abs(2 * l - 1))
  s = Math.abs(s)

  s = (s * saturation_scale_factor).toFixed(2)
  s = Math.round(s)

  l = Math.round(l)

  return color_to_hsla({ h, s, l, a })
}

/**
 * @param {string} color
 * @returns {object}
 */
export const hsla_to_color = hsla => {
  let color = hsla.substring(5, hsla.length - 1)
  color = color.split(', ')
  const [h, s_raw, l_raw, a] = color
  const s = s_raw.replace('%', '')
  const l = l_raw.replace('%', '')
  color = { h, s, l, a }
  return color_to_hsla(color)
}

/**
 * @param {object} hsla
 * @returns {object}
 */
export const color_to_hsla = ({ h, s, l, a }) => {
  const hsla = `hsla(${h}, ${s}%, ${l}%, ${a})`
  const ok = converter('oklch')(hsla)
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
