import { describe, it, expect } from 'vite-plus/test'
import { VOCABULARY, as_vocabulary_type } from '@/utils/vocabulary'

describe('@/utils/vocabulary', () => {
  it('publishes an absolute vocabulary, as microdata requires', () => {
    expect(VOCABULARY).toBe('https://realness.online')
  })

  describe('as_vocabulary_type', () => {
    it('reads the trailing segment of an absolute itemtype', () => {
      expect(as_vocabulary_type(`${VOCABULARY}/posters`)).toBe('posters')
    })

    it('reads posters saved before the vocabulary went absolute', () => {
      expect(as_vocabulary_type('/posters')).toBe('posters')
    })

    it('reads a schema.org itemtype', () => {
      expect(
        as_vocabulary_type('https://schema.org/SiteNavigationElement')
      ).toBe('SiteNavigationElement')
    })

    it('returns null for nothing', () => {
      expect(as_vocabulary_type(null)).toBeNull()
      expect(as_vocabulary_type('')).toBeNull()
      expect(as_vocabulary_type('/')).toBeNull()
    })
  })
})
