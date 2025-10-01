import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  use,
  is_use,
  is_url_query,
  settings_query,
  create_use_element,
  change_by
} from '@/use/layer'

// Mock dependencies
vi.mock('@/use/path', () => ({
  svg_ns: 'http://www.w3.org/2000/svg',
  use: () => ({
    get_active_path: vi.fn(() => ({
      getAttribute: vi.fn(() => 'regular'),
      style: {}
    }))
  })
}))

vi.mock('@/utils/opacity', () => ({
  change: vi.fn((current, delta) => {
    const value = parseFloat(current || '1')
    return Math.min(1, Math.max(0, value + delta)).toString()
  })
}))

vi.mock('@vueuse/core', () => ({
  whenever: vi.fn((source, callback) => {
    // Simple mock - just call the callback when source changes
    return { stop: vi.fn() }
  })
}))

describe('layer composable', () => {
  beforeEach(() => {
    // Mock DOM elements
    const mockSettings = document.createElement('div')
    mockSettings.setAttribute('itemscope', '')
    mockSettings.setAttribute('itemtype', '/settings')

    const mockLayer = document.createElement('div')
    mockLayer.setAttribute('itemprop', 'regular')
    mockLayer.style.fillOpacity = '1'
    mockLayer.style.strokeOpacity = '1'
    mockLayer.style.opacity = '1'

    mockSettings.appendChild(mockLayer)
    document.body.appendChild(mockSettings)
  })

  describe('change_by constant', () => {
    it('exports change_by as 0.08', () => {
      expect(change_by).toBe(0.08)
    })
  })

  describe('is_use', () => {
    it('returns false for non-object types', () => {
      expect(is_use(null)).toBe(false)
      expect(is_use(undefined)).toBe(false)
      expect(is_use('string')).toBe(false)
      expect(is_use(123)).toBe(false)
    })

    it('returns false for regular objects', () => {
      expect(is_use({})).toBe(false)
      expect(is_use([])).toBe(false)
    })

    it('returns true for SVGUseElement', () => {
      const useElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use'
      )
      expect(is_use(useElement)).toBe(true)
    })
  })

  describe('is_url_query', () => {
    it('always returns true', () => {
      expect(is_url_query('test')).toBe(true)
      expect(is_url_query('')).toBe(true)
      expect(is_url_query(null)).toBe(true)
    })
  })

  describe('settings_query', () => {
    it('queries settings element for layer by name', () => {
      const result = settings_query('regular')
      expect(result).toBeTruthy()
      expect(result.getAttribute('itemprop')).toBe('regular')
    })
  })

  describe('create_use_element', () => {
    it('creates SVG use element', () => {
      const element = create_use_element()
      expect(element.tagName.toLowerCase()).toBe('use')
      expect(element.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })
  })
})
