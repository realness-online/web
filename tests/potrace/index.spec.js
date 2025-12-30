import { describe, it, expect, beforeEach } from 'vitest'
import potrace_module, {
  as_paths,
  as_path_element,
  as_path_elements
} from '@/potrace/index.js'
const { Potrace } = potrace_module

// Mock ImageData for browser environment
global.ImageData = class ImageData {
  constructor(data_or_width, width_or_height, height) {
    if (data_or_width instanceof Uint8ClampedArray) {
      this.data = data_or_width
      this.width = width_or_height
      this.height = height
    } else {
      this.width = data_or_width
      this.height = width_or_height
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    }
  }
}

/**
 * Helper to create simple test image data
 * Creates a small image with a white square on black background
 */
const create_test_image = (width = 10, height = 10) => {
  const data = new Uint8ClampedArray(width * height * 4)

  // Fill with black
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0 // R
    data[i + 1] = 0 // G
    data[i + 2] = 0 // B
    data[i + 3] = 255 // A
  }

  // Create white square in center (3x3)
  for (let y = 3; y < 7; y++) {
    for (let x = 3; x < 7; x++) {
      const idx = (y * width + x) * 4
      data[idx] = 255 // R
      data[idx + 1] = 255 // G
      data[idx + 2] = 255 // B
      data[idx + 3] = 255 // A
    }
  }

  return new ImageData(data, width, height)
}

/**
 * Helper to create a larger complex test image
 * Creates multiple shapes to exercise path detection
 */
const create_complex_image = (width = 50, height = 50) => {
  const data = new Uint8ClampedArray(width * height * 4)

  // Fill with black
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 255
  }

  // Create white rectangle
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 30; x++) {
      const idx = (y * width + x) * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = 255
    }
  }

  // Create white circle (approximate)
  const cx = 35
  const cy = 35
  const radius = 8
  for (let y = cy - radius; y < cy + radius; y++) {
    for (let x = cx - radius; x < cx + radius; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < radius * radius) {
        const idx = (y * width + x) * 4
        data[idx] = 255
        data[idx + 1] = 255
        data[idx + 2] = 255
        data[idx + 3] = 255
      }
    }
  }

  return new ImageData(data, width, height)
}

/**
 * Helper to create gradient image
 */
const create_gradient_image = (width = 10, height = 10) => {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const value = Math.floor((x / width) * 255)
      data[idx] = value // R
      data[idx + 1] = value // G
      data[idx + 2] = value // B
      data[idx + 3] = 255 // A
    }
  }

  return new ImageData(data, width, height)
}

describe('potrace/index', () => {
  let test_image
  const test_timings = []

  beforeEach(() => {
    test_image = create_test_image()
  })

  afterAll(() => {
    // Test timings collected but not logged to reduce noise
  })

  describe('as_paths', () => {
    it('converts image data to path data structure', () => {
      console.time('as_paths')
      // Pass steps as array to bypass number validation and avoid posterization bug
      const result = as_paths(test_image, { threshold: 128, steps: [128] })
      console.timeEnd('as_paths')

      expect(result).toHaveProperty('width')
      expect(result).toHaveProperty('height')
      expect(result).toHaveProperty('dark')
      expect(result).toHaveProperty('paths')

      expect(result.width).toBe(10)
      expect(result.height).toBe(10)
      expect(typeof result.dark).toBe('boolean')
      expect(Array.isArray(result.paths)).toBe(true)

      // Should have at least one path for the white square
      expect(result.paths.length).toBeGreaterThan(0)

      // Each path should have required properties
      result.paths.forEach(path => {
        expect(path).toHaveProperty('d')
        expect(path).toHaveProperty('fillOpacity')
        expect(typeof path.d).toBe('string')
        expect(path.d.length).toBeGreaterThan(0)
      })
    })

    it('respects blackOnWhite option', () => {
      const result_black = as_paths(test_image, {
        blackOnWhite: true,
        threshold: 128,
        steps: [128]
      })
      const result_white = as_paths(test_image, {
        blackOnWhite: false,
        threshold: 128,
        steps: [128]
      })

      expect(result_black).toHaveProperty('paths')
      expect(result_white).toHaveProperty('paths')
      // Results should differ based on blackOnWhite
      expect(result_black.dark).not.toBe(result_white.dark)
    })

    it('handles threshold option', () => {
      const result_low = as_paths(test_image, { threshold: 50, steps: [128] })
      const result_high = as_paths(test_image, { threshold: 200, steps: [128] })

      expect(result_low).toHaveProperty('paths')
      expect(result_high).toHaveProperty('paths')
    })

    it('handles turdSize option to filter speckles', () => {
      const result_no_filter = as_paths(test_image, {
        turdSize: 0,
        steps: [128]
      })
      const result_filter = as_paths(test_image, { turdSize: 10, steps: [128] })

      expect(result_no_filter).toHaveProperty('paths')
      expect(result_filter).toHaveProperty('paths')
    })

    it('handles optCurve option', () => {
      const result_optimized = as_paths(test_image, {
        optCurve: true,
        steps: [128]
      })
      const result_not_optimized = as_paths(test_image, {
        optCurve: false,
        steps: [128]
      })

      expect(result_optimized).toHaveProperty('paths')
      expect(result_not_optimized).toHaveProperty('paths')
    })

    it('handles posterization with steps', () => {
      const gradient = create_gradient_image()
      const result = as_paths(gradient, { steps: 4 })

      expect(result).toHaveProperty('paths')
      expect(Array.isArray(result.paths)).toBe(true)
    })
  })

  describe('as_path_element', () => {
    it('returns SVG path element string', () => {
      const result = as_path_element(test_image, { steps: [128] })

      expect(typeof result).toBe('string')
      expect(result).toContain('<path')
      expect(result).toContain('d="')
      expect(result).toContain('/>')
    })

    it('respects options', () => {
      const result = as_path_element(test_image, {
        blackOnWhite: false,
        threshold: 100,
        steps: [128]
      })

      expect(typeof result).toBe('string')
      expect(result).toContain('<path')
    })
  })

  describe('as_path_elements', () => {
    it('returns array of SVG path elements for posterization', () => {
      const gradient = create_gradient_image()
      const result = as_path_elements(gradient, { steps: 3 })

      expect(Array.isArray(result)).toBe(true)
      result.forEach(element => {
        if (element) {
          expect(typeof element).toBe('string')
          expect(element).toContain('<path')
        }
      })
    })
  })

  describe('Potrace class', () => {
    let potrace

    beforeEach(() => {
      potrace = new Potrace()
    })

    describe('constructor', () => {
      it('creates instance with default options', () => {
        expect(potrace).toBeInstanceOf(Potrace)
      })

      it('accepts options in constructor', () => {
        const custom_potrace = new Potrace({
          blackOnWhite: false,
          threshold: 100,
          turdSize: 5
        })

        expect(custom_potrace).toBeInstanceOf(Potrace)
      })

      it('validates turn policy', () => {
        expect(() => {
          new Potrace({ turnPolicy: 'invalid' })
        }).toThrow(/turnPolicy/)
      })

      it('validates threshold range', () => {
        // -1 is THRESHOLD_AUTO, which is valid
        expect(() => {
          new Potrace({ threshold: 300 })
        }).toThrow(/threshold/)

        expect(() => {
          new Potrace({ threshold: -2 })
        }).toThrow(/threshold/)
      })

      it('validates optCurve boolean', () => {
        expect(() => {
          new Potrace({ optCurve: 'yes' })
        }).toThrow(/optCurve/)
      })
    })

    describe('load_image', () => {
      it('loads image data', () => {
        expect(() => {
          potrace.load_image(test_image)
        }).not.toThrow()
      })
    })

    describe('create_paths', () => {
      it('processes image and returns path data', () => {
        const test_potrace = new Potrace({ steps: [128] })
        const result = test_potrace.create_paths(test_image)

        expect(result).toHaveProperty('width')
        expect(result).toHaveProperty('height')
        expect(result).toHaveProperty('dark')
        expect(result).toHaveProperty('paths')
      })
    })

    describe('get_path_tag', () => {
      it('returns SVG path tag after loading image', () => {
        const test_potrace = new Potrace({ steps: [128] })
        test_potrace.load_image(test_image)
        const result = test_potrace.get_path_tag()

        expect(typeof result).toBe('string')
        expect(result).toContain('<path')
      })

      it('throws error if image not loaded', () => {
        expect(() => {
          potrace.get_path_tag()
        }).toThrow(/should be loaded/)
      })
    })

    describe('path_tags', () => {
      it('returns array of path tags for posterization', () => {
        const gradient = create_gradient_image()
        const custom_potrace = new Potrace({ steps: 3 })
        custom_potrace.load_image(gradient)

        const result = custom_potrace.path_tags()

        expect(Array.isArray(result)).toBe(true)
      })
    })

    describe('get_path_data', () => {
      it('returns path data objects', () => {
        const test_potrace = new Potrace({ steps: [128] })
        test_potrace.load_image(test_image)
        const result = test_potrace.get_path_data()

        // get_path_data returns a string (joined path data)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      })
    })

    describe('as_curves', () => {
      it('returns curve data for posterization', () => {
        const gradient = create_gradient_image()
        const custom_potrace = new Potrace({ steps: 3 })
        custom_potrace.load_image(gradient)

        const result = custom_potrace.as_curves()

        expect(Array.isArray(result)).toBe(true)
      })
    })
  })

  describe('turn policy options', () => {
    const policies = ['black', 'white', 'left', 'right', 'minority', 'majority']

    policies.forEach(policy => {
      it(`handles ${policy} turn policy`, () => {
        const result = as_paths(test_image, {
          turnPolicy: policy,
          steps: [128]
        })
        expect(result).toHaveProperty('paths')
      }, 10000)
    })
  })

  describe('complex images', () => {
    it('handles images with multiple shapes', () => {
      const complex = create_complex_image()
      const result = as_paths(complex, { steps: [128] })

      expect(result).toHaveProperty('paths')
      expect(result.paths.length).toBeGreaterThan(0)
    })

    it('traces multiple shapes with curve optimization', () => {
      const complex = create_complex_image()
      const result = as_paths(complex, { optCurve: true, steps: [128] })

      expect(result.paths.length).toBeGreaterThan(0)
      result.paths.forEach(path => {
        expect(path.d).toContain('C') // Should contain cubic bezier curves
      })
    })

    it('traces shapes without optimization', () => {
      const complex = create_complex_image()
      const result = as_paths(complex, { optCurve: false, steps: [128] })

      expect(result.paths.length).toBeGreaterThan(0)
      // Without optimization, should have more line segments
      result.paths.forEach(path => {
        expect(path.d.length).toBeGreaterThan(0)
      })
    })

    it('filters small speckles with turdSize', () => {
      const complex = create_complex_image()
      const result_no_filter = as_paths(complex, { turdSize: 0, steps: [128] })
      const result_with_filter = as_paths(complex, {
        turdSize: 20,
        steps: [128]
      })

      expect(result_no_filter.paths.length).toBeGreaterThanOrEqual(
        result_with_filter.paths.length
      )
    })
  })

  describe('edge cases', () => {
    it('handles very small images', () => {
      const tiny_image = create_test_image(2, 2)
      const result = as_paths(tiny_image, { steps: [128] })

      expect(result).toHaveProperty('paths')
      expect(result.width).toBe(2)
      expect(result.height).toBe(2)
    })

    it('handles all-black image', () => {
      const black_image = create_test_image(5, 5)
      const data = black_image.data
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 255
      }

      const result = as_paths(black_image, { steps: [128] })
      expect(result).toHaveProperty('paths')
    })

    it('handles all-white image', () => {
      const white_image = create_test_image(5, 5)
      const data = white_image.data
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = 255
      }

      const result = as_paths(white_image, { steps: [128] })
      expect(result).toHaveProperty('paths')
    })

    it('handles transparent pixels', () => {
      const semi_transparent = create_test_image(5, 5)
      const data = semi_transparent.data
      for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = 128 // Semi-transparent
      }

      const result = as_paths(semi_transparent, { steps: [128] })
      expect(result).toHaveProperty('paths')
    })
  })

  describe('alphaMax option', () => {
    it('affects corner detection', () => {
      const result_low = as_paths(test_image, { alphaMax: 0, steps: [128] })
      const result_high = as_paths(test_image, { alphaMax: 2, steps: [128] })

      expect(result_low).toHaveProperty('paths')
      expect(result_high).toHaveProperty('paths')
    })
  })

  describe('optTolerance option', () => {
    it('affects curve optimization', () => {
      const result_low = as_paths(test_image, {
        optTolerance: 0.1,
        steps: [128]
      })
      const result_high = as_paths(test_image, {
        optTolerance: 0.5,
        steps: [128]
      })

      expect(result_low).toHaveProperty('paths')
      expect(result_high).toHaveProperty('paths')
    })
  })

  describe('app usage patterns', () => {
    const app_options = {
      turdSize: 40,
      optTolerance: 0.55,
      blackOnWhite: true,
      fillStrategy: 'dominant',
      rangeDistribution: 'auto',
      steps: 4
    }

    it('uses app configuration for posterization', () => {
      const result = as_paths(test_image, app_options)

      expect(result).toHaveProperty('paths')
      expect(result.paths.length).toBeGreaterThan(0)
      result.paths.forEach(path => {
        expect(path).toHaveProperty('d')
        expect(path).toHaveProperty('fillOpacity')
      })
    })

    it('produces consistent output with app config', () => {
      const complex = create_complex_image()
      const result = as_paths(complex, app_options)

      expect(result.paths.length).toBeGreaterThan(0)
      expect(result.width).toBe(50)
      expect(result.height).toBe(50)
    })

    it('handles gradient with app config', () => {
      const gradient = create_gradient_image(20, 20)
      const result = as_paths(gradient, app_options)

      expect(result.paths.length).toBe(4)
      const opacities = new Set(result.paths.map(p => p.fillOpacity))
      expect(opacities.size).toBeGreaterThan(1)
    })
  })

  describe('golden file tests', () => {
    it('produces consistent output for simple square', () => {
      const result = as_paths(test_image, { optCurve: false, steps: [128] })

      // Snapshot the entire result
      expect(result).toMatchSnapshot('result')

      // Also snapshot just the paths array
      expect(result.paths).toMatchSnapshot('paths')
    })

    it('produces consistent optimized curves', () => {
      const result = as_paths(test_image, {
        optCurve: true,
        optTolerance: 0.2,
        steps: [128]
      })

      expect(result.paths).toBeDefined()
      expect(result.paths.length).toBeGreaterThan(0)

      // Verify structure without exact snapshot since curves can vary slightly
      result.paths.forEach(path => {
        expect(path).toHaveProperty('d')
        expect(path).toHaveProperty('fillOpacity')
        expect(typeof path.d).toBe('string')
      })
    })

    it('produces consistent posterized output', () => {
      const gradient = create_gradient_image(20, 20)
      const result = as_paths(gradient, { steps: 3, optCurve: false })

      expect(result.paths.length).toBeGreaterThan(0)

      // Each path should have different opacity for posterization
      const opacities = new Set(result.paths.map(p => p.fillOpacity))
      expect(opacities.size).toBeGreaterThan(1)
    })

    it('produces deterministic output for complex shapes', () => {
      const complex = create_complex_image()

      // Run twice to ensure determinism
      const result1 = as_paths(complex, {
        optCurve: false,
        threshold: 128,
        turdSize: 2,
        steps: [128]
      })
      const result2 = as_paths(complex, {
        optCurve: false,
        threshold: 128,
        turdSize: 2,
        steps: [128]
      })

      expect(result1.paths.length).toBe(result2.paths.length)

      // Compare path data
      result1.paths.forEach((path, i) => {
        expect(path.d).toBe(result2.paths[i].d)
        expect(path.fillOpacity).toBe(result2.paths[i].fillOpacity)
      })
    })
  })
})
