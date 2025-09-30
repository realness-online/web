/**
 * @fileoverview Internal color conversion utilities
 * Replaces external dependencies: rgb-hex, hsl-to-hex, culori, node-vibrant
 */

/**
 * Convert RGB values to hex string
 * Replaces rgb-hex package functionality
 * @param {number|string} red - Red value (0-255) or CSS rgb/rgba string
 * @param {number} green - Green value (0-255)
 * @param {number} blue - Blue value (0-255)
 * @param {number} alpha - Alpha value (0-1 or 0-100%)
 * @returns {string} Hex color string
 */
export const rgb_to_hex = (red, green, blue, alpha) => {
  let is_percent = (red + (alpha || '')).toString().includes('%')

  if (typeof red === 'string' && !green) {
    const parsed = parse_css_rgb_string(red)
    if (!parsed) throw new TypeError('Invalid or unsupported color format.')

    is_percent = false
    ;[red, green, blue, alpha] = parsed
  } else if (alpha !== undefined) alpha = Number.parseFloat(alpha)

  if (
    typeof red !== 'number' ||
    typeof green !== 'number' ||
    typeof blue !== 'number' ||
    red > 255 ||
    green > 255 ||
    blue > 255
  )
    throw new TypeError('Expected three numbers below 256')

  if (typeof alpha === 'number') {
    if (!is_percent && alpha >= 0 && alpha <= 1) alpha = Math.round(255 * alpha)
    else if (is_percent && alpha >= 0 && alpha <= 100)
      alpha = Math.round((255 * alpha) / 100)
    else
      throw new TypeError(
        `Expected alpha value (${alpha}) as a fraction or percentage`
      )

    alpha = (alpha | (1 << 8)).toString(16).slice(1)
  } else alpha = ''

  return to_hex(red, green, blue, alpha)
}

/**
 * Convert HSL values to hex string
 * Replaces hsl-to-hex package functionality
 * @param {number} hue - Hue in degrees (0-359)
 * @param {number} saturation - Saturation percentage (0-100)
 * @param {number} lightness - Lightness percentage (0-100)
 * @returns {string} Hex color string
 */
export const hsl_to_hex = (hue, saturation, lightness) => {
  // Resolve degrees to 0 - 359 range
  hue = cycle_hue(hue)

  // Enforce constraints
  saturation = clamp(saturation, 0, 100)
  lightness = clamp(lightness, 0, 100)

  // Convert to 0 to 1 range
  saturation /= 100
  lightness /= 100

  // Convert HSL to RGB
  const rgb = hsl_to_rgb(hue, saturation, lightness)

  // Convert each value to 2 character hex value
  return `#${rgb.map(n => (256 + n).toString(16).substr(-2)).join('')}`
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

  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ]
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {object} HSL object with h, s, l properties
 */
export const rgb_to_hsl = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min)

    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / diff + 2
        break
      case b:
        h = (r - g) / diff + 4
        break
    }
    h /= 6
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
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
  const rgb = hsl_to_rgb(h, s / 100, l / 100)

  // Convert RGB to linear RGB
  const linear_rgb = rgb.map(val => {
    val = val / 255
    return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  // Convert linear RGB to OKLab
  const [lr, lg, lb] = linear_rgb
  const l_oklab = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_oklab = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_oklab = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_cubed = Math.cbrt(l_oklab)
  const m_cubed = Math.cbrt(m_oklab)
  const s_cubed = Math.cbrt(s_oklab)

  const l_oklab_final =
    0.2104542553 * l_cubed + 0.793617785 * m_cubed - 0.0040720468 * s_cubed
  const a_oklab =
    1.9779984951 * l_cubed - 2.428592205 * m_cubed + 0.4505937099 * s_cubed
  const b_oklab =
    0.0259040371 * l_cubed + 0.7827717662 * m_cubed - 0.808675766 * s_cubed

  // Convert OKLab to OKLCH
  const l_oklch = l_oklab_final
  const c_oklch = Math.sqrt(a_oklab * a_oklab + b_oklab * b_oklab)
  const h_oklch = (Math.atan2(b_oklab, a_oklab) * 180) / Math.PI

  return {
    l: l_oklch,
    c: c_oklch,
    h: h_oklch < 0 ? h_oklch + 360 : h_oklch
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
  const sample_size = Math.max(1, Math.floor(Math.min(width, height) / 4))
  const colors = []

  for (let y = 0; y < height; y += sample_size)
    for (let x = 0; x < width; x += sample_size) {
      const index = (y * width + x) * 4
      const r = pixels[index]
      const g = pixels[index + 1]
      const b = pixels[index + 2]
      const a = pixels[index + 3]

      if (a > 128)
        // Skip transparent pixels
        colors.push({ r, g, b })
    }

  // Group similar colors and find most prominent
  const color_groups = group_similar_colors(colors)
  const sorted_groups = color_groups.sort((a, b) => b.count - a.count)

  return {
    vibrant: sorted_groups[0]?.color || '#000000',
    muted: sorted_groups[1]?.color || '#666666',
    dark_vibrant: sorted_groups[2]?.color || '#333333',
    light_vibrant: sorted_groups[3]?.color || '#cccccc',
    dark_muted: sorted_groups[4]?.color || '#444444',
    light_muted: sorted_groups[5]?.color || '#aaaaaa'
  }
}

// Helper functions

const to_hex = (red, green, blue, alpha) =>
  `#${(blue | (green << 8) | (red << 16) | (1 << 24)).toString(16).slice(1)}${alpha}`

const parse_css_rgb_string = input => {
  const parts = input
    .replace(/rgba?\(([^)]+)\)/, '$1')
    .split(/[,\s/]+/)
    .filter(Boolean)
  if (parts.length < 3) return

  const parse_value = (value, max) => {
    value = value.trim()
    if (value.endsWith('%'))
      return Math.min((Number.parseFloat(value) * max) / 100, max)

    return Math.min(Number.parseFloat(value), max)
  }

  const red = parse_value(parts[0], 255)
  const green = parse_value(parts[1], 255)
  const blue = parse_value(parts[2], 255)
  let alpha

  if (parts.length === 4) alpha = parse_value(parts[3], 1)

  return [red, green, blue, alpha]
}

const cycle_hue = val => {
  val = clamp(val, -1e7, 1e7)
  while (val < 0) val += 360
  while (val > 359) val -= 360
  return val
}

const clamp = (val, min, max) => (val < min ? min : val > max ? max : val)

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
