import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as vector from '@/workers/vector'
import potrace from '@realness.online/potrace'

// Define constants to avoid magic numbers
const MOCK_RGB_VALUES = [0.3, 0.4, 0.5]
const MAX_PATHS = 100
const MOCK_DIMENSIONS = {
  DEFAULT_WIDTH: 333,
  DEFAULT_HEIGHT: 444,
  WIDE_WIDTH: 666
}

const image = read_mock_file('@@/images/house.jpeg')
const poster_html = read_mock_file('@@/html/poster.html')

const mock_image = {
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

  beforeEach(() => {
    as_paths_spy = vi
      .spyOn(potrace, 'as_paths')
      .mockImplementation(() => Promise.resolve(mock_vector))

    postMessage_spy = vi.spyOn(global, 'postMessage').mockImplementation(() => true)
  })

  describe('listen', () => {
    it('creates a vector from a jpeg', async () => {
      await vector.listen({ data: { image } })
      expect(as_paths_spy).toBeCalled()
      expect(postMessage_spy).toBeCalled()
    })

    it('handles different aspect ratios', async () => {
      const wider_image = {
        ...mock_image,
        bitmap: {
          ...mock_image.bitmap,
          width: MOCK_DIMENSIONS.WIDE_WIDTH
        }
      }
      await vector.listen({ data: { wider_image } })
      expect(as_paths_spy).toBeCalled()
      expect(postMessage_spy).toBeCalled()
    })
  })

  describe('make', () => {
    it('handles large vectors', async () => {
      const large = {
        paths: Array(MAX_PATHS).fill(image)
      }

      as_paths_spy.mockImplementationOnce(() => Promise.resolve(large))
      await vector.make(mock_image)
      expect(mock_image.resize).toBeCalled()
    })
  })
})
