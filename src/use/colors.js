import rgb_to_hex from 'rgb-hex'
import hsl_to_hex from 'hsl-to-hex'

export function to_hex(color = '') {
  if (color.startsWith('#')) return color
  if (color.startsWith('rgb')) return `#${rgb_to_hex(color)}`
  if (color.startsWith('hsl')) return hsl_to_hex(color)
  throw `Provided color is unrecognized — ${color}`
}
// https://una.im/css-color-theming
// takes hex rgb or hsl value and returns hsl object
export function to_hsl(color = '') {
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
    r = '0x' + H[1] + H[2]
    g = '0x' + H[3] + H[4]
    b = '0x' + H[5] + H[6]
  }
  // Then to HSL
  r /= 255
  g /= 255
  b /= 255
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
  return {
    color: `hsl(${h},${s}%,${l}%)`,
    h,
    s,
    l
  }
}

export function to_complimentary_hsl(color = '') {
  let hsl = to_hsl(color)
  const h = hsl.h + 180
  const s = 100 - hsl.s
  let l = 100 - hsl.l
  const new_color = `hsl(${h},${s}%,${l}%)`
  console.log('')
  console.log(color)
  console.log(new_color)
  return {
    color: new_color,
    h,
    s,
    l
  }
}

export function luminosity(color, change_by) {
  const hsl = to_hsl(color)
  const l = parseInt(hsl.l) + parseInt(change_by)
  return {
    color: `hsl(${hsl.h},${hsl.s}%,${l}%)`,
    h: hsl.h,
    s: hsl.s,
    l
  }
}

// 100% saturation is completely saturated (full color),
// while 0% is completely unsaturated (gray)
//
// 100% lightness is white,
// 0% lightness is black
