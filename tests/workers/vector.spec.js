import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import * as vector from '@/workers/vector'
import {
  make_image_data,
  horizontal_ramp,
  solid
} from '../helpers/pixel-image.js'

// Mock potrace
vi.mock('@/potrace/index.js', () => ({
  as_paths: vi.fn().mockReturnValue({
    paths: ['<svg><rect width="100" height="100"/></svg>'],
    width: 333,
    height: 444,
    dark: true
  })
}))

// Make potrace available globally for the tests
global.potrace = {
  trace: vi.fn().mockResolvedValue({ paths: [] }),
  default: vi.fn().mockResolvedValue({ paths: [] }),
  as_paths: vi.fn().mockResolvedValue({ paths: [] })
}

global.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

// Define constants to avoid magic numbers
const MOCK_RGB_VALUES = [0.3, 0.4, 0.5]
const MAX_PATHS = 100
const MOCK_DIMENSIONS = {
  DEFAULT_WIDTH: 333,
  DEFAULT_HEIGHT: 444,
  WIDE_WIDTH: 666
}

// Mock image data instead of reading from file
const image = new ArrayBuffer(1024) // Mock image data
const poster_html = '<svg><rect width="100" height="100"/></svg>' // Mock HTML

const mock_image = {
  width: MOCK_DIMENSIONS.DEFAULT_WIDTH,
  height: MOCK_DIMENSIONS.DEFAULT_HEIGHT,
  data: new Uint8ClampedArray(
    MOCK_DIMENSIONS.DEFAULT_WIDTH * MOCK_DIMENSIONS.DEFAULT_HEIGHT * 4
  ),
  bitmap: {
    width: MOCK_DIMENSIONS.DEFAULT_WIDTH,
    height: MOCK_DIMENSIONS.DEFAULT_HEIGHT,
    data: MOCK_RGB_VALUES
  },
  scan: vi.fn(() => mock_image),
  resize: vi.fn(() => mock_image),
  normalize: vi.fn(() => mock_image),
  threshold: vi.fn(() => mock_image),
  dither565: vi.fn(() => mock_image),
  posterize: vi.fn(() => mock_image),
  contrast: vi.fn(() => mock_image),
  color: vi.fn(() => mock_image)
}

const mock_vector = {
  paths: [poster_html]
}

describe('vector worker', () => {
  let as_paths_spy
  let postMessage_spy

  beforeEach(async () => {
    const potrace_module = await import('@/potrace/index.js')
    as_paths_spy = vi
      .spyOn(potrace_module, 'as_paths')
      .mockImplementation(image_data => ({
        paths: ['<svg><rect width="100" height="100"/></svg>'],
        width: image_data.width,
        height: image_data.height,
        dark: true
      }))

    postMessage_spy = vi
      .spyOn(global, 'postMessage')
      .mockImplementation(() => true)
  })

  describe('make_vector', () => {
    it('creates a vector from a jpeg', async () => {
      const message = { data: { image_data: mock_image } }
      const result = await vector.make_vector(message)
      expect(as_paths_spy).toBeCalled()
      expect(result).toHaveProperty('vector')
      expect(result.vector).toHaveProperty('light')
      expect(result.vector).toHaveProperty('regular')
      expect(result.vector).toHaveProperty('medium')
      expect(result.vector).toHaveProperty('bold')
    })

    it('handles different aspect ratios', async () => {
      const wider_image = {
        ...mock_image,
        width: MOCK_DIMENSIONS.WIDE_WIDTH
      }
      const message = { data: { image_data: wider_image } }
      const result = await vector.make_vector(message)
      expect(as_paths_spy).toBeCalled()
      expect(result).toHaveProperty('vector')
      expect(result.vector.width).toBe(MOCK_DIMENSIONS.WIDE_WIDTH)
    })
  })

  describe('make_gradient', () => {
    const gradients_for = image_data =>
      vector.make_gradient({ data: { image_data } }).gradients

    it('handles large vectors', async () => {
      const message = { data: { image_data: mock_image } }
      const result = await vector.make_gradient(message)
      expect(result).toHaveProperty('gradients')
      expect(result.gradients).toHaveProperty('horizontal')
      expect(result.gradients).toHaveProperty('vertical')
      expect(result.gradients).toHaveProperty('radial')
    })

    it('places each stop at the middle of its strip, pinned to both edges', () => {
      const { horizontal } = gradients_for(horizontal_ramp(100, 40))
      expect(horizontal.map(stop => stop.offset)).toEqual([
        0, 22.5, 37.5, 52.5, 67.5, 82.5, 100
      ])
    })

    it('reads the picture: a ramp comes back as rising luminosity', () => {
      const { horizontal } = gradients_for(horizontal_ramp(100, 40))
      const lightness = horizontal.map(stop => stop.color.l)
      const rising = lightness.every(
        (value, i) => i === 0 || value > lightness[i - 1]
      )
      expect(rising).toBe(true)
    })

    it('keeps the last strip inside the picture', () => {
      // The final strip used to run 5% past the edge and average in the
      // transparent black a canvas pads out-of-bounds reads with
      const { horizontal } = gradients_for(solid(100, 40, [255, 255, 255]))
      for (const stop of horizontal) expect(stop.color.l).toBe(100)
    })

    it('reads a flat colour back as itself', () => {
      const { vertical } = gradients_for(solid(60, 60, [200, 30, 30]))
      for (const stop of vertical) {
        expect(stop.color.h).toBe(0)
        expect(stop.color.s).toBeGreaterThan(50)
      }
    })

    it('samples the vertical axis by rows, not columns', () => {
      // Dark top half, light bottom half: only a row-wise read sees a step
      const image = make_image_data(40, 100, (x, y) => {
        const value = y < 50 ? 0 : 255
        return [value, value, value, 255]
      })
      const { vertical } = gradients_for(image)
      expect(vertical[0].color.l).toBeLessThan(20)
      expect(vertical.at(-1).color.l).toBeGreaterThan(80)
    })

    it('averages in linear light, so half black and half white reads bright', () => {
      // A plain mean of gamma-encoded bytes gives 128, which reads as a
      // middle grey the picture does not contain. Linear light gives ~188.
      const checker = make_image_data(40, 40, (x, y) => {
        const value = (x + y) % 2 === 0 ? 0 : 255
        return [value, value, value, 255]
      })
      const { horizontal } = gradients_for(checker)
      for (const stop of horizontal) expect(stop.color.l).toBeGreaterThan(65)
    })

    it('ignores what is not there: transparent pixels carry no colour', () => {
      // Half the image is transparent black. Summing it in drags every stop
      // toward black even though nothing in the picture is dark.
      const half_clear = make_image_data(40, 40, (x, y) =>
        y % 2 === 0 ? [255, 0, 0, 255] : [0, 0, 0, 0]
      )
      const { horizontal } = gradients_for(half_clear)
      for (const stop of horizontal) {
        expect(stop.color.h).toBe(0)
        expect(stop.color.l).toBeGreaterThan(45)
      }
    })

    it('survives an image narrower than one sampling chunk', () => {
      const { horizontal } = gradients_for(solid(1, 1, [10, 20, 30]))
      expect(horizontal.length).toBeGreaterThan(0)
    })
  })

  describe('optimize_vector', () => {
    it('strips what svgo can strip', async () => {
      const messy =
        '<svg xmlns="http://www.w3.org/2000/svg"><!-- note --><g><rect x="0" y="0" width="10" height="10"/></g></svg>'
      const { vector: optimized } = await vector.route_message({
        data: { route: 'optimize:vector', vector: messy }
      })
      expect(optimized).not.toContain('note')
      expect(optimized.length).toBeLessThan(messy.length)
    })
  })

  describe('normalize_morph', () => {
    it('passes the alignment options through to normalize_set', async () => {
      const { paths } = await vector.route_message({
        data: {
          route: 'normalize:morph',
          paths: ['M0 0 L10 0 L10 10 Z', 'M0 0 L20 0 L20 20 Z'],
          contours: 1,
          segments: 4,
          precision: 1
        }
      })
      expect(paths).toHaveLength(2)
      for (const path of paths) expect(typeof path).toBe('string')
    })
  })

  describe('route_message', () => {
    it('warns on a route it does not know and replies empty', async () => {
      const console_warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})
      const reply = await vector.route_message({ data: { route: 'make:tea' } })
      expect(reply).toEqual({})
      expect(console_warn).toHaveBeenCalledWith('unknown route', 'make:tea')
      console_warn.mockRestore()
    })
  })

  describe('worker message listener', () => {
    it('posts an error reply instead of hanging when route_message throws', async () => {
      const console_error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      as_paths_spy.mockImplementation(() => {
        throw new Error('trace failed')
      })

      self.dispatchEvent(
        new MessageEvent('message', {
          data: { id: 'trace-1', route: 'make:vector', image_data: mock_image }
        })
      )
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(postMessage_spy).toHaveBeenCalledWith({
        id: 'trace-1',
        error: 'trace failed'
      })
      expect(console_error).toHaveBeenCalled()
      console_error.mockRestore()
    })

    it('echoes the request id so a shared worker can match its replies', async () => {
      self.dispatchEvent(
        new MessageEvent('message', {
          data: {
            id: 'gradient-7',
            route: 'make:gradient',
            image_data: solid(20, 20, [10, 20, 30])
          }
        })
      )
      await new Promise(resolve => setTimeout(resolve, 0))

      const [reply] = postMessage_spy.mock.calls.at(-1)
      expect(reply.id).toBe('gradient-7')
      expect(reply.gradients).toBeTruthy()
    })
  })
})
