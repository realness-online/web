import rgb_to_hex from 'rgb-hex'
import hsl_to_hex from 'hsl-to-hex'
import css_var from '@/use/css-var'
import { converter } from 'culori'

// import { useMode, modeHsl, modeOklch, converter } from 'culori/fn'
// useMode(modeOklch)
// useMode(modeHsl)

export const to_hex = (color = '') => {
  if (color.length === 0) color = '--black-dark'
  if (color.startsWith('--')) color = css_var(color).trim()
  if (color.startsWith('#')) return color
  let hex
  if (color.startsWith('rgb')) hex = `#${rgb_to_hex(color)}`
  if (color.startsWith('hsl')) hex = hsl_to_hex(color)
  if (hex.length === 9) return hex.slice(0, -2)
  else if (hex.length === 7) return hex
  else throw `Provided color is unrecognized — ${color}`
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
  if (H.length == 4) {
    r = '0x' + H[1] + H[1]
    g = '0x' + H[2] + H[2]
    b = '0x' + H[3] + H[3]
  } else if (H.length == 7) {
    // todo accomidate hex with alpha
    r = '0x' + H[1] + H[2]
    g = '0x' + H[3] + H[4]
    b = '0x' + H[5] + H[6]
  }
  return rgba_to_hsla({ r, g, b, a: 255 })
}
export const to_complimentary_hsl = (color = '') => {
  let hsl = to_hsla(color)
  const h = hsl.h + 180
  const s = 100 - hsl.s
  let l = 100 - hsl.l
  return color_to_hsla({ h, s, l, a: hsl.a })
}
export const luminosity = (color, change_by) => {
  const hsl = to_hsla(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return color_to_hsla({ h: hsl.h, s: hsl.s, l, a: hsl.a })
}

export const rgba_to_hsla = ({ r, g, b, a }) => {
  // Then to HSL
  r /= 255
  g /= 255
  b /= 255
  a /= 255
  a = a.toFixed(2)
  let cmin = Math.min(r, g, b)
  let cmax = Math.max(r, g, b)
  let delta = cmax - cmin
  let h = 0
  let s = 0
  let l = 0

  if (delta == 0) h = 0
  else if (cmax == r) h = ((g - b) / delta) % 6
  else if (cmax == g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4

  h = Math.round(h * 60)

  if (h < 0) h += 360

  l = (cmax + cmin) / 2
  l = +(l * 100).toFixed(2)

  s = delta == 0 ? 0 : delta / (1 + Math.abs(2 * l - 1))
  s = Math.abs(s)

  s = (s * 10000).toFixed(2)

  s = Math.round(s)
  l = Math.round(l)

  return color_to_hsla({ h, s, l, a })
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
  const ok = converter('oklch')(hsla)
  ok.h = Math.round(ok.h)
  return {
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsla: hsla,
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
