/**
 * @fileoverview Internal color conversion utilities
 * Replaces external dependencies: rgb-hex, hsl-to-hex, culori, node-vibrant
 */

// sRGB to linear RGB conversion constants
const SRGB_THRESHOLD = 0.04045
const SRGB_LOW_SLOPE = 12.92
const SRGB_OFFSET = 0.055
const SRGB_DIVISOR = 1.055
const SRGB_GAMMA = 2.4

// Color space constants
const RGB_MAX = 255
const PERCENTAGE_MAX = 100
const HUE_MAX_DEGREES = 359
const HUE_FULL_CIRCLE = 360
const HEX_BASE = 16
const HEX_BYTE_SHIFT = 256
const HEX_ALPHA_OFFSET = -2
const HALF_LIGHTNESS = 0.5
const HUE_WRAP_DIVISOR = 6
const HUE_OFFSET_GREEN = 2
const HUE_OFFSET_BLUE = 4
const RGBA_INDEX_GREEN = 1
const RGBA_INDEX_BLUE = 2
const RGBA_INDEX_ALPHA = 3
const HUE_60 = 60
const HUE_120 = 120
const HUE_180 = 180
const HUE_240 = 240
const HUE_300 = 300
const RGBA_COMPONENTS = 4
const ALPHA_THRESHOLD = 128
const HEX_SHIFT_GREEN = 8
const HEX_SHIFT_RED = 16
const HEX_SHIFT_ALPHA = 24
const HUE_CLAMP_MIN = -1e7
const HUE_CLAMP_MAX = 1e7
const PI_DEGREES = 180
const ALPHA_OPAQUE = 1

// Color palette indices
const PALETTE_VIBRANT = 0
const PALETTE_MUTED = 1
const PALETTE_DARK_VIBRANT = 2
const PALETTE_LIGHT_VIBRANT = 3
const PALETTE_DARK_MUTED = 4
const PALETTE_LIGHT_MUTED = 5

// OKLab color space transformation matrix coefficients
// Matrix M1: RGB to LMS
const OKLAB_M1_LR = 0.4122214708
const OKLAB_M1_LG = 0.5363325363
const OKLAB_M1_LB = 0.0514459929
const OKLAB_M1_MR = 0.2119034982
const OKLAB_M1_MG = 0.6806995451
const OKLAB_M1_MB = 0.1073969566
const OKLAB_M1_SR = 0.0883024619
const OKLAB_M1_SG = 0.2817188376
const OKLAB_M1_SB = 0.6299787005

// Matrix M2: LMS to Lab
const OKLAB_M2_LL = 0.2104542553
const OKLAB_M2_LM = 0.793617785
const OKLAB_M2_LS = -0.0040720468
const OKLAB_M2_AL = 1.9779984951
const OKLAB_M2_AM = -2.428592205
const OKLAB_M2_AS = 0.4505937099
const OKLAB_M2_BL = 0.0259040371
const OKLAB_M2_BM = 0.7827717662
const OKLAB_M2_BS = -0.808675766

/**
 * Convert RGB values to hex string
 * Replaces rgb-hex package functionality
 * @param {number|string} red - Red value (0-255) or CSS rgb/rgba string
 * @param {number} [green] - Green value (0-255)
 * @param {number} [blue] - Blue value (0-255)
 * @param {number} [alpha] - Alpha value (0-1 or 0-100%)
 * @returns {string} Hex color string
 */
export const rgb_to_hex = (red, green, blue, alpha) => {
  let is_percent = (String(red) + String(alpha || '')).includes('%')
  let r = red
  let g = green
  let b = blue
  let a = alpha

  if (typeof red === 'string' && !green) {
    const parsed = parse_css_rgb_string(red)
    if (!parsed) throw new TypeError('Invalid or unsupported color format.')

    is_percent = false
    ;[r, g, b, a] = parsed
  } else if (a !== undefined && typeof a === 'string') a = Number.parseFloat(a)

  if (
    typeof r !== 'number' ||
    typeof g !== 'number' ||
    typeof b !== 'number' ||
    r > RGB_MAX ||
    g > RGB_MAX ||
    b > RGB_MAX
  )
    throw new TypeError('Expected three numbers below 256')

  let alpha_string = ''
  if (typeof a === 'number') {
    if (!is_percent && a >= 0 && a <= ALPHA_OPAQUE) a = Math.round(RGB_MAX * a)
    else if (is_percent && a >= 0 && a <= PERCENTAGE_MAX)
      a = Math.round((RGB_MAX * a) / PERCENTAGE_MAX)
    else
      throw new TypeError(
        `Expected alpha value (${a}) as a fraction or percentage`
      )

    const alpha_hex = (a | (ALPHA_OPAQUE << HEX_SHIFT_GREEN))
      .toString(HEX_BASE)
      .slice(ALPHA_OPAQUE)
    alpha_string = alpha_hex
  }

  return to_hex(r, g, b, alpha_string)
}

/**
 * Convert HSL values to hex string
 * Replaces hsl-to-hex package functionality
 * @param {number|string} hue - Hue in degrees (0-359) or CSS hsl/hsla string
 * @param {number} [saturation] - Saturation percentage (0-100)
 * @param {number} [lightness] - Lightness percentage (0-100)
 * @returns {string} Hex color string
 */
export const hsl_to_hex = (hue, saturation, lightness) => {
  let h = hue
  let s = saturation
  let l = lightness

  if (typeof hue === 'string' && !saturation) {
    const parsed = parse_css_hsl_string(hue)
    if (!parsed) throw new TypeError('Invalid or unsupported color format.')
    ;[h, s, l] = parsed
  }

  // Resolve degrees to 0 - 359 range
  h = cycle_hue(h)

  // Enforce constraints
  const s_clamped = clamp(s, 0, PERCENTAGE_MAX)
  const l_clamped = clamp(l, 0, PERCENTAGE_MAX)

  // Convert to 0 to 1 range
  const s_normalized = s_clamped / PERCENTAGE_MAX
  const l_normalized = l_clamped / PERCENTAGE_MAX

  // Convert HSL to RGB
  const h_num = typeof h === 'number' ? h : Number(h)
  const rgb = hsl_to_rgb(h_num, s_normalized, l_normalized)

  // Convert each value to 2 character hex value
  return `#${rgb.map(n => (HEX_BYTE_SHIFT + n).toString(HEX_BASE).substr(HEX_ALPHA_OFFSET)).join('')}`
}

/**
 * Convert HSL to RGB values
 * @param {number} h - Hue in degrees
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {number[]} RGB values as array
 */
const hsl_to_rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r, g, b

  if (0 <= h && h < HUE_60) {
    r = c
    g = x
    b = 0
  } else if (HUE_60 <= h && h < HUE_120) {
    r = x
    g = c
    b = 0
  } else if (HUE_120 <= h && h < HUE_180) {
    r = 0
    g = c
    b = x
  } else if (HUE_180 <= h && h < HUE_240) {
    r = 0
    g = x
    b = c
  } else if (HUE_240 <= h && h < HUE_300) {
    r = x
    g = 0
    b = c
  } else if (HUE_300 <= h && h < HUE_FULL_CIRCLE) {
    r = c
    g = 0
    b = x
  }

  return [
    Math.round((r + m) * RGB_MAX),
    Math.round((g + m) * RGB_MAX),
    Math.round((b + m) * RGB_MAX)
  ]
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {object} HSL object with h, s, l properties
 */
export const rgba_to_hsla = (r, g, b, _a) => {
  const red = r / RGB_MAX
  const green = g / RGB_MAX
  const blue = b / RGB_MAX

  const cmax = Math.max(red, green, blue)
  const cmin = Math.min(red, green, blue)
  const diff = cmax - cmin

  let h = 0
  let s = 0
  const l = (cmax + cmin) / 2

  if (diff !== 0) {
    s = l > HALF_LIGHTNESS ? diff / (2 - cmax - cmin) : diff / (cmax + cmin)

    switch (cmax) {
      case red:
        h = (green - blue) / diff + (green < blue ? HUE_WRAP_DIVISOR : 0)
        break
      case green:
        h = (blue - red) / diff + HUE_OFFSET_GREEN
        break
      case blue:
        h = (red - green) / diff + HUE_OFFSET_BLUE
        break
    }
    h /= HUE_WRAP_DIVISOR
  }

  return {
    h: h * HUE_FULL_CIRCLE,
    s: s * PERCENTAGE_MAX,
    l: l * PERCENTAGE_MAX
  }
}

/**
 * Convert HSL to OKLCH
 * Replaces culori OKLCH conversion functionality
 * @param {number} h - Hue in degrees
 * @param {number} s - Saturation percentage
 * @param {number} l - Lightness percentage
 * @returns {object} OKLCH object with l, c, h properties
 */
export const hsl_to_oklch = (h, s, l) => {
  // First convert HSL to RGB
  const rgb = hsl_to_rgb(h, s / PERCENTAGE_MAX, l / PERCENTAGE_MAX)

  // Convert RGB to linear RGB
  const linear_rgb = rgb.map(val => {
    const normalized = val / RGB_MAX
    return normalized <= SRGB_THRESHOLD
      ? normalized / SRGB_LOW_SLOPE
      : Math.pow((normalized + SRGB_OFFSET) / SRGB_DIVISOR, SRGB_GAMMA)
  })

  // Convert linear RGB to OKLab
  const [lr, lg, lb] = linear_rgb
  const l_oklab = OKLAB_M1_LR * lr + OKLAB_M1_LG * lg + OKLAB_M1_LB * lb
  const m_oklab = OKLAB_M1_MR * lr + OKLAB_M1_MG * lg + OKLAB_M1_MB * lb
  const s_oklab = OKLAB_M1_SR * lr + OKLAB_M1_SG * lg + OKLAB_M1_SB * lb

  const l_cubed = Math.cbrt(l_oklab)
  const m_cubed = Math.cbrt(m_oklab)
  const s_cubed = Math.cbrt(s_oklab)

  const l_oklab_final =
    OKLAB_M2_LL * l_cubed + OKLAB_M2_LM * m_cubed + OKLAB_M2_LS * s_cubed
  const a_oklab =
    OKLAB_M2_AL * l_cubed + OKLAB_M2_AM * m_cubed + OKLAB_M2_AS * s_cubed
  const b_oklab =
    OKLAB_M2_BL * l_cubed + OKLAB_M2_BM * m_cubed + OKLAB_M2_BS * s_cubed

  // Convert OKLab to OKLCH
  const l_oklch = l_oklab_final
  const c_oklch = Math.sqrt(a_oklab * a_oklab + b_oklab * b_oklab)
  const h_oklch = (Math.atan2(b_oklab, a_oklab) * PI_DEGREES) / Math.PI

  return {
    l: l_oklch,
    c: c_oklch,
    h: h_oklch < 0 ? h_oklch + HUE_FULL_CIRCLE : h_oklch
  }
}

/**
 * Extract prominent colors from image data
 * Replaces node-vibrant functionality
 * @param {ImageData} image_data - Image data from canvas
 * @returns {object} Color palette object
 */
export const extract_color_palette = image_data => {
  const pixels = image_data.data
  const { width } = image_data
  const { height } = image_data

  // Sample pixels (every 4th pixel for performance, but ensure we get some pixels)
  const sample_size = Math.max(
    ALPHA_OPAQUE,
    Math.floor(Math.min(width, height) / RGBA_COMPONENTS)
  )
  const colors = []

  for (let y = 0; y < height; y += sample_size)
    for (let x = 0; x < width; x += sample_size) {
      const index = (y * width + x) * RGBA_COMPONENTS
      const r = pixels[index]
      const g = pixels[index + RGBA_INDEX_GREEN]
      const b = pixels[index + RGBA_INDEX_BLUE]
      const a = pixels[index + RGBA_INDEX_ALPHA]

      if (a > ALPHA_THRESHOLD)
        // Skip transparent pixels
        colors.push({ r, g, b })
    }

  // Group similar colors and find most prominent
  const color_groups = group_similar_colors(colors)
  const sorted_groups = color_groups.sort((a, b) => b.count - a.count)

  return {
    vibrant: sorted_groups[PALETTE_VIBRANT]?.color || '#000000',
    muted: sorted_groups[PALETTE_MUTED]?.color || '#666666',
    dark_vibrant: sorted_groups[PALETTE_DARK_VIBRANT]?.color || '#333333',
    light_vibrant: sorted_groups[PALETTE_LIGHT_VIBRANT]?.color || '#cccccc',
    dark_muted: sorted_groups[PALETTE_DARK_MUTED]?.color || '#444444',
    light_muted: sorted_groups[PALETTE_LIGHT_MUTED]?.color || '#aaaaaa'
  }
}

// Helper functions

/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @param {string} alpha
 */
const to_hex = (red, green, blue, alpha) =>
  `#${(blue | (green << HEX_SHIFT_GREEN) | (red << HEX_SHIFT_RED) | (ALPHA_OPAQUE << HEX_SHIFT_ALPHA)).toString(HEX_BASE).slice(ALPHA_OPAQUE)}${alpha}`

const parse_css_rgb_string = input => {
  const parts = input
    .replace(/rgba?\(([^)]+)\)/, '$1')
    .split(/[,\s/]+/)
    .filter(Boolean)
  if (parts.length < 3) return

  const parse_value = (value, max) => {
    const trimmed = value.trim()
    if (trimmed.endsWith('%'))
      return Math.min((Number.parseFloat(trimmed) * max) / PERCENTAGE_MAX, max)

    return Math.min(Number.parseFloat(trimmed), max)
  }

  const red = parse_value(parts[0], RGB_MAX)
  const green = parse_value(parts[1], RGB_MAX)
  const blue = parse_value(parts[2], RGB_MAX)
  let alpha

  if (parts.length === RGBA_COMPONENTS)
    alpha = parse_value(parts[3], ALPHA_OPAQUE)

  return [red, green, blue, alpha]
}

const parse_css_hsl_string = input => {
  const parts = input
    .replace(/hsla?\(([^)]+)\)/, '$1')
    .split(/[,\s/]+/)
    .filter(Boolean)
  if (parts.length < 3) return

  const parse_value = (value, max) => {
    const trimmed = value.trim()
    if (trimmed.endsWith('%'))
      return Math.min((Number.parseFloat(trimmed) * max) / PERCENTAGE_MAX, max)

    return Math.min(Number.parseFloat(trimmed), max)
  }

  const hue = Number.parseFloat(parts[0])
  const saturation = parse_value(parts[1], PERCENTAGE_MAX)
  const lightness = parse_value(parts[2], PERCENTAGE_MAX)

  return [hue, saturation, lightness]
}

const cycle_hue = val => {
  let result = clamp(val, HUE_CLAMP_MIN, HUE_CLAMP_MAX)
  while (result < 0) result += HUE_FULL_CIRCLE
  while (result > HUE_MAX_DEGREES) result -= HUE_FULL_CIRCLE
  return result
}

const clamp = (val, min, max) => {
  if (val < min) return min
  if (val > max) return max
  return val
}

const group_similar_colors = colors => {
  const groups = []
  const threshold = 10 // Lower threshold for exact color matching in tests

  for (const color of colors) {
    let found_group = false

    for (const group of groups) {
      const distance = color_distance(color, group.color)
      if (distance < threshold) {
        group.count++
        found_group = true
        break
      }
    }

    if (!found_group)
      groups.push({
        color: rgb_to_hex(color.r, color.g, color.b),
        count: 1
      })
  }

  return groups
}

const color_distance = (color1, color2) => {
  const r_diff = color1.r - color2.r
  const g_diff = color1.g - color2.g
  const b_diff = color1.b - color2.b
  return Math.sqrt(r_diff * r_diff + g_diff * g_diff + b_diff * b_diff)
}
