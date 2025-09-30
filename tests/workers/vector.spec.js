import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as vector from '@/workers/vector'

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

// Mock browser APIs
global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width
    this.height = height
  }
  getContext() {
    return {
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
      drawImage: () => {}
    }
  }
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
    it('handles large vectors', async () => {
      const message = { data: { image_data: mock_image } }
      const result = await vector.make_gradient(message)
      expect(result).toHaveProperty('gradients')
      expect(result.gradients).toHaveProperty('horizontal')
      expect(result.gradients).toHaveProperty('vertical')
      expect(result.gradients).toHaveProperty('radial')
    })
  })
})
