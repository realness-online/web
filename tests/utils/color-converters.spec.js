import { describe, it, expect, beforeEach } from 'vitest'
import {
  rgb_to_hex,
  hsl_to_hex,
  rgba_to_hsla,
  hsl_to_oklch,
  extract_color_palette
} from '@/utils/color-converters'

// Mock ImageData for testing
beforeEach(() => {
  global.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
})

describe('rgb_to_hex', () => {
  it('converts RGB numbers to hex', () => {
    expect(rgb_to_hex(255, 0, 0)).toBe('#ff0000')
    expect(rgb_to_hex(0, 255, 0)).toBe('#00ff00')
    expect(rgb_to_hex(0, 0, 255)).toBe('#0000ff')
    expect(rgb_to_hex(128, 128, 128)).toBe('#808080')
  })

  it('converts RGB string to hex', () => {
    expect(rgb_to_hex('rgb(255, 0, 0)')).toBe('#ff0000')
    expect(rgb_to_hex('rgb(0, 255, 0)')).toBe('#00ff00')
    expect(rgb_to_hex('rgba(255, 0, 0, 0.5)')).toBe('#ff000080')
  })

  it('handles percentage values', () => {
    expect(rgb_to_hex('rgb(100%, 0%, 0%)')).toBe('#ff0000')
    expect(rgb_to_hex('rgba(100%, 0%, 0%, 50%)')).toBe('#ff000080')
  })

  it('throws error for invalid values', () => {
    expect(() => rgb_to_hex(256, 0, 0)).toThrow(
      'Expected three numbers below 256'
    )
    expect(() => rgb_to_hex('invalid')).toThrow(
      'Invalid or unsupported color format'
    )
  })
})

describe('hsl_to_hex', () => {
  it('converts HSL to hex', () => {
    expect(hsl_to_hex(0, 100, 50)).toBe('#ff0000') // Red
    expect(hsl_to_hex(120, 100, 50)).toBe('#00ff00') // Green
    expect(hsl_to_hex(240, 100, 50)).toBe('#0000ff') // Blue
    expect(hsl_to_hex(0, 0, 50)).toBe('#808080') // Gray
  })

  it('handles hue cycling', () => {
    expect(hsl_to_hex(360, 100, 50)).toBe('#ff0000') // Same as 0
    expect(hsl_to_hex(-60, 100, 50)).toBe('#ff00ff') // Same as 300 (magenta)
  })

  it('clamps saturation and lightness', () => {
    expect(hsl_to_hex(0, 150, 50)).toBe('#ff0000') // Clamped to 100
    expect(hsl_to_hex(0, 100, -10)).toBe('#000000') // Clamped to 0
  })
})

describe('rgba_to_hsla', () => {
  it('converts RGB to HSL', () => {
    const red = rgba_to_hsla(255, 0, 0, 0)
    expect(red.h).toBeCloseTo(0, 1)
    expect(red.s).toBeCloseTo(100, 1)
    expect(red.l).toBeCloseTo(50, 1)

    const green = rgba_to_hsla(0, 255, 0, 0)
    expect(green.h).toBeCloseTo(120, 1)
    expect(green.s).toBeCloseTo(100, 1)
    expect(green.l).toBeCloseTo(50, 1)

    const blue = rgba_to_hsla(0, 0, 255, 0)
    expect(blue.h).toBeCloseTo(240, 1)
    expect(blue.s).toBeCloseTo(100, 1)
    expect(blue.l).toBeCloseTo(50, 1)
  })

  it('handles grayscale', () => {
    const gray = rgba_to_hsla(128, 128, 128, 0)
    expect(gray.s).toBeCloseTo(0, 1)
    expect(gray.l).toBeCloseTo(50.2, 1) // Allow for slight rounding differences
  })
})

describe('hsl_to_oklch', () => {
  it('converts HSL to OKLCH', () => {
    const red_oklch = hsl_to_oklch(0, 100, 50)
    expect(red_oklch.l).toBeGreaterThan(0)
    expect(red_oklch.c).toBeGreaterThan(0)
    expect(red_oklch.h).toBeCloseTo(29.2, 1) // OKLCH hue values differ from HSL

    const green_oklch = hsl_to_oklch(120, 100, 50)
    expect(green_oklch.l).toBeGreaterThan(0)
    expect(green_oklch.c).toBeGreaterThan(0)
    expect(green_oklch.h).toBeCloseTo(142.5, 1) // OKLCH hue values differ from HSL
  })

  it('handles grayscale in OKLCH', () => {
    const gray_oklch = hsl_to_oklch(0, 0, 50)
    expect(gray_oklch.c).toBeCloseTo(0, 3) // Chroma should be near 0 for grayscale
  })
})

describe('extract_color_palette', () => {
  it('extracts colors from image data', () => {
    // Create a simple 2x2 red image
    const image_data = new ImageData(2, 2)
    const pixels = image_data.data

    // Fill with red pixels
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 // R
      pixels[i + 1] = 0 // G
      pixels[i + 2] = 0 // B
      pixels[i + 3] = 255 // A
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#ff0000')
    expect(palette.muted).toBe('#ff0000')
  })

  it('handles transparent pixels', () => {
    const image_data = new ImageData(2, 2)
    const pixels = image_data.data

    // Fill with transparent pixels
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 // R
      pixels[i + 1] = 0 // G
      pixels[i + 2] = 0 // B
      pixels[i + 3] = 0 // A (transparent)
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#000000') // Fallback color
  })

  it('handles mixed colors', () => {
    const image_data = new ImageData(4, 4)
    const pixels = image_data.data

    // Create a pattern with red and blue pixels
    for (let i = 0; i < pixels.length; i += 4) {
      const pixel_index = i / 4
      if (pixel_index % 2 === 0) {
        // Red pixels
        pixels[i] = 255
        pixels[i + 1] = 0
        pixels[i + 2] = 0
      } else {
        // Blue pixels
        pixels[i] = 0
        pixels[i + 1] = 0
        pixels[i + 2] = 255
      }
      pixels[i + 3] = 255 // A
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#ff0000') // Most prominent
    expect(palette.muted).toBe('#0000ff') // Second most prominent
  })
})

describe('color conversion roundtrip', () => {
  it('converts RGB to HSL and back to hex', () => {
    const original_rgb = { r: 255, g: 128, b: 64 }
    const hsl = rgba_to_hsla(original_rgb.r, original_rgb.g, original_rgb.b, 0)
    const hex = hsl_to_hex(hsl.h, hsl.s, hsl.l)

    // Verify HSL values are reasonable
    expect(hsl.h).toBeGreaterThanOrEqual(0)
    expect(hsl.h).toBeLessThanOrEqual(360)
    expect(hsl.s).toBeGreaterThanOrEqual(0)
    expect(hsl.s).toBeLessThanOrEqual(100)
    expect(hsl.l).toBeGreaterThanOrEqual(0)
    expect(hsl.l).toBeLessThanOrEqual(100)

    // Verify hex is valid
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

// Helper function for tests
const hex_to_rgb = hex => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}
