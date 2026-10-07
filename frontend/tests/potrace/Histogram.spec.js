import Histogram from '@/potrace/types/Histogram'

describe('@/potrace/types/Histogram', () => {
  describe('get_stats', () => {
    it('returns a finite pixelsPerLevel.mean for a single-level range', () => {
      const histogram = new Histogram(256)
      histogram.data[100] = 42

      const stats = histogram.get_stats(100, 100)

      expect(stats.pixels).toBe(42)
      expect(stats.pixelsPerLevel.mean).toBe(42)
      expect(Number.isFinite(stats.pixelsPerLevel.mean)).toBe(true)
    })

    it('still returns a finite mean for a multi-level range', () => {
      const histogram = new Histogram(256)
      histogram.data[50] = 10
      histogram.data[60] = 10

      const stats = histogram.get_stats(50, 60)

      expect(stats.pixelsPerLevel.mean).toBe(20 / 10)
      expect(Number.isFinite(stats.pixelsPerLevel.mean)).toBe(true)
    })
  })
})
