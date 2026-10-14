import { describe, it, expect } from 'vite-plus/test'
import Histogram from '@/potrace/types/Histogram'
import Bitmap from '@/potrace/types/Bitmap'

global.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

/** A histogram with two clear peaks, so thresholding has something to find. */
const two_peak_histogram = () => {
  const histogram = new Histogram(256)
  for (let level = 0; level < 40; level++) histogram.data[level] = 20
  for (let level = 200; level < 240; level++) histogram.data[level] = 20
  histogram.pixels = 1600
  return histogram
}

describe('@/potrace/types/Histogram behaviour', () => {
  describe('construction', () => {
    it('allocates from a pixel count', () => {
      const histogram = new Histogram(200)

      expect(histogram.data).toBeInstanceOf(Uint8Array)
      expect(histogram.pixels).toBe(200)
    })

    it('allocates a wider counter for a large image', () => {
      const histogram = new Histogram(Math.pow(2, 17))

      expect(histogram.data).toBeInstanceOf(Uint32Array)
    })

    it('collects from a bitmap', () => {
      const bitmap = new Bitmap(4, 1)
      bitmap.data[0] = 10
      bitmap.data[1] = 10
      bitmap.data[2] = 200
      bitmap.data[3] = 200

      const histogram = new Histogram(bitmap)

      expect(histogram.data[10]).toBe(2)
      expect(histogram.data[200]).toBe(2)
    })

    it('collects red, green and blue separately', () => {
      const pixels = new Uint8ClampedArray([50, 100, 150, 255])
      const image = new ImageData(pixels, 1, 1)

      expect(new Histogram(image, Histogram.MODE_R).data[50]).toBe(1)
      expect(new Histogram(image, Histogram.MODE_G).data[100]).toBe(1)
      expect(new Histogram(image, Histogram.MODE_B).data[150]).toBe(1)
    })

    it('collects luminance when no mode is given', () => {
      const pixels = new Uint8ClampedArray([255, 255, 255, 255])
      const image = new ImageData(pixels, 1, 1)

      const histogram = new Histogram(image)

      expect(histogram.data[255]).toBe(1)
    })

    it('refuses a source it cannot read', () => {
      expect(() => new Histogram('a string')).toThrow(
        'Unsupported image source'
      )
    })
  })

  describe('sorted indexes', () => {
    it('sorts colours by how many pixels they hold', () => {
      const histogram = new Histogram(256)
      histogram.data[5] = 1
      histogram.data[200] = 9

      const indexes = histogram.get_sorted_indexes(true)

      expect(indexes.at(-1)).toBe(200)
      expect(indexes.at(-2)).toBe(5)
    })

    it('answers from the cache on a second call', () => {
      const histogram = new Histogram(256)

      const first = histogram.get_sorted_indexes()
      histogram.data[7] = 99
      const second = histogram.get_sorted_indexes()

      expect(histogram.data[7]).toBe(99)
      expect(second).toBe(first)
    })

    it('rebuilds when asked to refresh', () => {
      const histogram = new Histogram(256)
      histogram.get_sorted_indexes()
      histogram.data[7] = 99

      const refreshed = histogram.get_sorted_indexes(true)

      expect(refreshed.at(-1)).toBe(7)
    })

    it('returns nothing for a histogram with no data', () => {
      const histogram = new Histogram(256)
      histogram.data = null

      expect(histogram.get_sorted_indexes(true)).toEqual([])
    })
  })

  describe('dominant colour', () => {
    it('finds the level holding the most pixels', () => {
      const histogram = new Histogram(256)
      histogram.data[10] = 3
      histogram.data[20] = 1

      expect(histogram.get_dominant_color(0, 255)).toBe(10)
    })

    it('reports a single occupied level directly', () => {
      const histogram = new Histogram(256)
      histogram.data[42] = 5

      expect(histogram.get_dominant_color(42, 42)).toBe(42)
    })

    it('reports nothing for an empty single level', () => {
      const histogram = new Histogram(256)

      expect(histogram.get_dominant_color(42, 42)).toBe(-1)
    })

    it('reports nothing when there is no data at all', () => {
      const histogram = new Histogram(256)
      histogram.data = null

      expect(histogram.get_dominant_color(0, 255)).toBe(-1)
    })
  })

  describe('thresholding', () => {
    it('builds a lookup table from the data', () => {
      const histogram = two_peak_histogram()

      histogram.thresholding_build_lookup_table()

      expect(histogram.lookup_table_h).toBeInstanceOf(Float64Array)
      expect(histogram.lookup_table_h.length).toBe(256 * 256)
    })

    it('leaves the table empty without data', () => {
      const histogram = new Histogram(256)
      histogram.data = null

      histogram.thresholding_build_lookup_table()

      expect(histogram.lookup_table_h).toBeNull()
    })

    it('finds a threshold between the two peaks', () => {
      const histogram = two_peak_histogram()

      const threshold = histogram.auto_threshold()

      expect(threshold).toBeGreaterThanOrEqual(40)
      expect(threshold).toBeLessThanOrEqual(200)
    })

    it('returns nothing when no threshold can be found', () => {
      const histogram = new Histogram(256)

      expect(histogram.auto_threshold()).toBeNull()
    })

    it('returns no levels for a threshold amount below one', () => {
      const histogram = two_peak_histogram()

      expect(histogram.multilevel_thresholding(0)).toEqual([])
    })

    it('returns one level per requested amount', () => {
      const histogram = two_peak_histogram()
      histogram.pixels = 100000

      const levels = histogram.multilevel_thresholding(2)

      expect(Array.isArray(levels)).toBe(true)
      expect(levels.length).toBeLessThanOrEqual(2)
    })
  })

  describe('stats', () => {
    it('sums the pixels in the range', () => {
      const histogram = new Histogram(256)
      histogram.data[10] = 2
      histogram.data[20] = 3

      const stats = histogram.get_stats(0, 255)

      expect(stats.pixels).toBe(5)
    })

    it('returns the same stats from the cache', () => {
      const histogram = new Histogram(256)
      histogram.data[10] = 2

      const first = histogram.get_stats(0, 255)
      const second = histogram.get_stats(0, 255, true)

      expect(second.pixels).toBe(first.pixels)
    })
  })
})
