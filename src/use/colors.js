import rgb_to_hex from 'rgb-hex'
import hsl_to_hex from 'hsl-to-hex'
import css_var from '@/utils/css-var'
import { useMode as use_mode, modeHsl as mode_hsl, modeOklch as mode_oklch, converter } from 'culori/fn'
use_mode(mode_oklch)
use_mode(mode_hsl)

/**
 * @typedef {Object} hsla_color
 * @property {string} hsl - HSL color string (e.g. "hsl(360, 100%, 50%)")
 * @property {string} hsla - HSLA color string (e.g. "hsla(360, 100%, 50%, 1)")
 * @property {string} oklch - OKLCH color string (e.g. "oklch(0.500, 0.200, 360)")
 * @property {number} h - Hue value (0-360)
 * @property {number} s - Saturation value (0-100)
 * @property {number} l - Lightness value (0-100)
 * @property {number} a - Alpha value (0-1)
 */

/**
 * Converts HSL color values to multiple color format representations
 * @param {{h: number, s: number, l: number, a: number}} param0 HSL color values
 * @returns {{
 *   hsl: string,
 *   hsla: string,
 *   oklch: string,
 *   h: number,
 *   s: number,
 *   l: number,
 *   a: number
 * }} Color in multiple formats
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

/**
 * @param {{
 *   r: number,
 *   g: number,
 *   b: number,
 *   a: number
 * }}
 */
export const rgba_to_hsla = ({ r, g, b, a }) => {
  // Then to HSL
  const r_norm = r / 255
  const g_norm = g / 255
  const b_norm = b / 255
  const cmin = Math.min(r_norm, g_norm, b_norm)
  const cmax = Math.max(r_norm, g_norm, b_norm)
  const delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  if (delta === 0) h = 0
  else if (cmax === r_norm) h = ((g_norm - b_norm) / delta) % 6
  else if (cmax === g_norm) h = (b_norm - r_norm) / delta + 2
  else h = (r_norm - g_norm) / delta + 4

  h = Math.round(h * 60)

  if (h < 0) h += 360

  l = (cmax + cmin) / 2
  l = +(l * 100).toFixed(2)

  s = delta === 0 ? 0 : delta / (1 + Math.abs(2 * l - 1))
  s = Math.abs(s)

  s = (s * 10000).toFixed(2)

  s = Math.round(s)
  l = Math.round(l)

  return color_to_hsla({ h, s, l, a })
}

/**
 * Converts a color to hexadecimal format
 * @param {string} [color=''] Color value in RGB, HSL, or CSS variable format
 * @returns {string} Hexadecimal color value
 * @throws {string} If color format is unrecognized
 */
export const to_hex = (color = '') => {
  if (color.length === 0) color = '--black-dark'
  if (color?.startsWith('--')) color = css_var(color).trim()
  if (color?.startsWith('#')) return color
  let hex = ''
  if (color?.startsWith('rgb')) hex = `#${rgb_to_hex(color)}`
  if (color?.startsWith('hsl')) hex = hsl_to_hex(color)
  if (!hex) throw `Provided color is unrecognized — ${color}`
  if (hex.length === 9) return hex.slice(0, -2)
  return hex
}

/**
 * Converts a hex color string to its numeric value
 * @param {string} color Hexadecimal color string
 * @returns {number} Numeric value of the hex color
 */
export const to_hex_number = color => parseInt(color.substring(1))

/**
 * Converts a color to HSLA format
 * @param {string} [color=''] Color in hex, RGB, or HSL format
 * @returns {hsla_color} HSLA color object
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
  if (H.length === 4) {
    r = parseInt(`0x${H[1]}${H[1]}`)
    g = parseInt(`0x${H[2]}${H[2]}`)
    b = parseInt(`0x${H[3]}${H[3]}`)
  } else if (H.length === 7) {
    // todo accommodate hex with alpha
    r = parseInt(`0x${H[1]}${H[2]}`)
    g = parseInt(`0x${H[3]}${H[4]}`)
    b = `0x${H[5]}${H[6]}`
  }
  return rgba_to_hsla({ r, g, b, a: 255 })
}

/**
 * Generates a complementary color in HSL format
 * @param {string} [color=''] Base color to generate complement from
 * @returns {Object} Complementary color in HSLA format
 */
export const to_complimentary_hsl = (color = '') => {
  const hsl = to_hsla(color)
  const h = hsl.h + 180
  const s = 100 - hsl.s
  const l = 100 - hsl.l
  return color_to_hsla({ h, s, l, a: hsl.a })
}

/**
 * Adjusts the luminosity of a color
 * @param {string} color Base color
 * @param {number} change_by Amount to adjust luminosity by
 * @returns {Object} Modified color in HSLA format
 */
export const luminosity = (color, change_by) => {
  const hsl = to_hsla(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return color_to_hsla({ h: hsl.h, s: hsl.s, l, a: hsl.a })
}

/**
 * Converts HSLA string to color object
 * @param {string} hsla HSLA color string
 * @returns {Object} Color object with HSLA values
 */
export const hsla_to_color = hsla => {
  const [h, s, l, a] = hsla
    .substring(5, hsla.length - 1)
    .split(', ')
    .map((val, i) => {
      const num = i === 1 || i === 2 ? parseFloat(val.replace('%', '')) : parseFloat(val)
      return num
    })

  return color_to_hsla({ h, s, l, a })
}

// https://una.im/css-color-theming
// 100% saturation is completely saturated (full color),
// while 0% is unsaturated (gray), 50% is normal
// 100% lightness is white,
// 50% is normal
// 0% lightness is black
