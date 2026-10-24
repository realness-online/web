import { describe, it, expect, beforeEach } from 'vite-plus/test'
import {
  rgb_to_hex,
  hsl_to_hex,
  rgba_to_hsla,
  hsl_to_oklch,
  oklch_to_rgb,
  oklch_to_hex,
  parse_css_oklch_string,
  extract_color_palette
} from '@/utils/color-converters'

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

describe('rgb_to_hex string and alpha forms', () => {
  it('reads an rgb CSS string', () => {
    expect(rgb_to_hex('rgb(255, 0, 0)')).toBe('#ff0000')
    expect(rgb_to_hex('rgb(0 128 0)')).toBe('#008000')
  })

  it('reads an rgba CSS string with an alpha fraction', () => {
    expect(rgb_to_hex('rgba(255, 0, 0, 0.5)')).toBe('#ff000080')
  })

  it('reads percentages in an rgb string', () => {
    expect(rgb_to_hex('rgb(100%, 0%, 0%)')).toBe('#ff0000')
  })

  it('reads a numeric alpha as a fraction', () => {
    expect(rgb_to_hex(255, 0, 0, 0.5)).toBe('#ff000080')
  })

  it('rejects an alpha outside the range', () => {
    expect(() => rgb_to_hex(255, 0, 0, 5)).toThrow(
      'Expected alpha value (5) as a fraction or percentage'
    )
  })

  it('takes an alpha given as a string', () => {
    expect(rgb_to_hex(255, 0, 0, '0.5')).toBe('#ff000080')
  })
})

describe('hsl_to_hex', () => {
  it('converts HSL to hex', () => {
    expect(hsl_to_hex(0, 100, 50)).toBe('#ff0000')
    expect(hsl_to_hex(120, 100, 50)).toBe('#00ff00')
    expect(hsl_to_hex(240, 100, 50)).toBe('#0000ff')
    expect(hsl_to_hex(0, 0, 50)).toBe('#808080')
  })

  it('handles hue cycling', () => {
    expect(hsl_to_hex(360, 100, 50)).toBe('#ff0000')
    expect(hsl_to_hex(-60, 100, 50)).toBe('#ff00ff')
  })

  it('clamps saturation and lightness', () => {
    expect(hsl_to_hex(0, 150, 50)).toBe('#ff0000')
    expect(hsl_to_hex(0, 100, -10)).toBe('#000000')
  })

  it('reads an hsl CSS string', () => {
    expect(hsl_to_hex('hsl(120, 100%, 25%)')).toBe('#008000')
  })

  it('reads a modern hsl string with spaces', () => {
    expect(hsl_to_hex('hsl(240 100% 50%)')).toBe('#0000ff')
  })

  it('falls through when the string carries no hue and no saturation argument', () => {
    /** Only a second argument lets the parser run; a lone string is parsed as a hue. */
    const lone_string = 'not a color'
    expect(typeof hsl_to_hex(lone_string)).toBe('string')
  })
})

describe('oklch parsing guards', () => {
  it('returns undefined for input with no oklch function', () => {
    expect(parse_css_oklch_string('#ff0000')).toBeUndefined()
  })

  it('returns undefined when fewer than three components are given', () => {
    expect(parse_css_oklch_string('oklch(0.5 0.1)')).toBeUndefined()
  })

  it('reads a slash separated alpha', () => {
    expect(parse_css_oklch_string('oklch(0.5 0.1 200 / 0.4)')).toEqual({
      l: 0.5,
      c: 0.1,
      h: 200,
      a: 0.4
    })
  })

  it('defaults the alpha to opaque', () => {
    expect(parse_css_oklch_string('oklch(0.5 0.1 200)').a).toBe(1)
  })
})

describe('oklch_to_rgb without a hue', () => {
  it('treats a missing hue as zero chroma', () => {
    const [r, g, b] = oklch_to_rgb(0.5, 0.1, NaN)

    expect(r).toBe(g)
    expect(g).toBe(b)
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
    expect(gray.l).toBeCloseTo(50.2, 1)
  })
})

describe('hsl_to_oklch', () => {
  it('converts HSL to OKLCH', () => {
    const red_oklch = hsl_to_oklch(0, 100, 50)
    expect(red_oklch.l).toBeGreaterThan(0)
    expect(red_oklch.c).toBeGreaterThan(0)
    expect(red_oklch.h).toBeCloseTo(29.2, 1)

    const green_oklch = hsl_to_oklch(120, 100, 50)
    expect(green_oklch.l).toBeGreaterThan(0)
    expect(green_oklch.c).toBeGreaterThan(0)
    expect(green_oklch.h).toBeCloseTo(142.5, 1)
  })

  it('handles grayscale in OKLCH', () => {
    const gray_oklch = hsl_to_oklch(0, 0, 50)
    expect(gray_oklch.c).toBeCloseTo(0, 3)
  })
})

describe('oklch_to_rgb', () => {
  it('converts OKLCH to RGB', () => {
    const [r, g, b] = oklch_to_rgb(0.5, 0.2, 29)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(255)
    expect(g).toBeGreaterThanOrEqual(0)
    expect(g).toBeLessThanOrEqual(255)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(255)
  })
})

describe('oklch_to_hex', () => {
  it('converts OKLCH to hex', () => {
    const hex = oklch_to_hex(0.5, 0.2, 29)
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('parse_css_oklch_string', () => {
  it('parses oklch CSS string', () => {
    const result = parse_css_oklch_string('oklch(0.5, 0.2, 29)')
    expect(result).toEqual({ l: 0.5, c: 0.2, h: 29, a: 1 })
  })

  it('parses oklch with alpha', () => {
    const result = parse_css_oklch_string('oklch(0.5, 0.2, 29 / 0.8)')
    expect(result.l).toBe(0.5)
    expect(result.c).toBe(0.2)
    expect(result.h).toBe(29)
  })
})

describe('extract_color_palette', () => {
  it('extracts colors from image data', () => {
    const image_data = new ImageData(2, 2)
    const pixels = image_data.data

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 255
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#ff0000')
    expect(palette.muted).toBe('#ff0000')
  })

  it('handles transparent pixels', () => {
    const image_data = new ImageData(2, 2)
    const pixels = image_data.data

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 0
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#000000')
  })

  it('handles mixed colors', () => {
    const image_data = new ImageData(4, 4)
    const pixels = image_data.data

    for (let i = 0; i < pixels.length; i += 4) {
      const pixel_index = i / 4
      if (pixel_index % 2 === 0) {
        pixels[i] = 255
        pixels[i + 1] = 0
        pixels[i + 2] = 0
      } else {
        pixels[i] = 0
        pixels[i + 1] = 0
        pixels[i + 2] = 255
      }
      pixels[i + 3] = 255
    }

    const palette = extract_color_palette(image_data)
    expect(palette.vibrant).toBe('#ff0000')
    expect(palette.muted).toBe('#0000ff')
  })
})

describe('color conversion roundtrip', () => {
  it('converts RGB to HSL and back to hex', () => {
    const original_rgb = { r: 255, g: 128, b: 64 }
    const hsl = rgba_to_hsla(original_rgb.r, original_rgb.g, original_rgb.b, 0)
    const hex = hsl_to_hex(hsl.h, hsl.s, hsl.l)

    expect(hsl.h).toBeGreaterThanOrEqual(0)
    expect(hsl.h).toBeLessThanOrEqual(360)
    expect(hsl.s).toBeGreaterThanOrEqual(0)
    expect(hsl.s).toBeLessThanOrEqual(100)
    expect(hsl.l).toBeGreaterThanOrEqual(0)
    expect(hsl.l).toBeLessThanOrEqual(100)

    expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

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
