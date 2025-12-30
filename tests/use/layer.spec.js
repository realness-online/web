import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import {
  use,
  is_use,
  is_url_query,
  settings_query,
  create_use_element,
  change_by
} from '@/use/layer'
import { change } from '@/utils/opacity'

const mock_get_active_path = vi.fn()

// Mock dependencies
vi.mock('@/use/path', () => ({
  svg_ns: 'http://www.w3.org/2000/svg',
  use: () => ({
    get_active_path: mock_get_active_path
  })
}))

vi.mock('@vueuse/core', () => ({
  whenever: vi.fn((source, callback) => {
    return { stop: vi.fn() }
  })
}))

function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return result
}

describe('layer composable', () => {
  let mock_settings
  let mock_layer

  beforeEach(() => {
    vi.clearAllMocks()

    mock_settings = document.createElement('div')
    mock_settings.setAttribute('itemscope', '')
    mock_settings.setAttribute('itemtype', '/settings')

    mock_layer = document.createElement('div')
    mock_layer.setAttribute('itemprop', 'regular')
    mock_layer.style.fillOpacity = '0.5'
    mock_layer.style.strokeOpacity = '0.6'
    mock_layer.style.opacity = '0.7'

    mock_settings.appendChild(mock_layer)
    document.body.innerHTML = ''
    document.body.appendChild(mock_settings)

    mock_get_active_path.mockReturnValue({
      getAttribute: vi.fn(() => 'regular'),
      style: {}
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
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

    it('throws error when settings element not found', () => {
      document.body.innerHTML = ''
      expect(() => settings_query('nonexistent')).toThrow()
    })
  })

  describe('create_use_element', () => {
    it('creates SVG use element', () => {
      const element = create_use_element()
      expect(element.tagName.toLowerCase()).toBe('use')
      expect(element.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })
  })

  describe('use composable', () => {
    describe('get_active_layer', () => {
      it('returns null when no active path', () => {
        mock_get_active_path.mockReturnValue(null)
        const layer_instance = with_setup(() => use())
        const result = layer_instance.get_active_layer()
        expect(result).toBe(null)
      })

      it('returns null when path has no itemprop attribute', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => null)
        })
        const layer_instance = with_setup(() => use())
        const result = layer_instance.get_active_layer()
        expect(result).toBe(null)
      })

      it('returns layer element when path has itemprop', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        const result = layer_instance.get_active_layer()
        expect(result).toBe(mock_layer)
        expect(layer_instance.selected_layer.value).toBe('regular')
      })

      it('sets opacity_percentage from fillOpacity when as_stroke is false', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        layer_instance.as_stroke.value = false
        layer_instance.get_active_layer()
        expect(layer_instance.opacity_percentage.value).toBe('0.5')
      })

      it('sets opacity_percentage from strokeOpacity when as_stroke is true', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        layer_instance.as_stroke.value = true
        layer_instance.get_active_layer()
        expect(layer_instance.opacity_percentage.value).toBe('0.6')
      })
    })

    describe('fill_opacity', () => {
      it('updates fillOpacity when layer exists', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        const initial_opacity = parseFloat(mock_layer.style.fillOpacity)
        layer_instance.fill_opacity(change_by)
        const new_opacity = parseFloat(mock_layer.style.fillOpacity)
        expect(new_opacity).toBe(change(initial_opacity, change_by))
      })

      it('does nothing when no active layer', () => {
        mock_get_active_path.mockReturnValue(null)
        const layer_instance = with_setup(() => use())
        expect(() => layer_instance.fill_opacity(change_by)).not.toThrow()
      })
    })

    describe('stroke_opacity', () => {
      it('updates strokeOpacity when layer exists', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        const initial_opacity = parseFloat(mock_layer.style.strokeOpacity)
        layer_instance.stroke_opacity(change_by)
        const new_opacity = parseFloat(mock_layer.style.strokeOpacity)
        expect(new_opacity).toBe(change(initial_opacity, change_by))
      })

      it('does nothing when no active layer', () => {
        mock_get_active_path.mockReturnValue(null)
        const layer_instance = with_setup(() => use())
        expect(() => layer_instance.stroke_opacity(change_by)).not.toThrow()
      })
    })

    describe('opacity', () => {
      it('updates opacity when layer exists', () => {
        mock_get_active_path.mockReturnValue({
          getAttribute: vi.fn(() => 'regular')
        })
        const layer_instance = with_setup(() => use())
        const initial_opacity = parseFloat(mock_layer.style.opacity)
        layer_instance.opacity(change_by)
        const new_opacity = parseFloat(mock_layer.style.opacity)
        expect(new_opacity).toBe(change(initial_opacity, change_by))
      })

      it('does nothing when no active layer', () => {
        mock_get_active_path.mockReturnValue(null)
        const layer_instance = with_setup(() => use())
        expect(() => layer_instance.opacity(change_by)).not.toThrow()
      })
    })

    describe('initialization', () => {
      it('initializes refs correctly on mount', () => {
        const layer_instance = with_setup(() => use())
        expect(layer_instance.selected_layer.value).toBe(null)
        expect(layer_instance.opacity_percentage.value).toBe(null)
        expect(layer_instance.as_stroke.value).toBe(false)
      })

      it('returns all expected properties', () => {
        const layer_instance = with_setup(() => use())
        expect(layer_instance.as_stroke).toBeDefined()
        expect(layer_instance.fill_opacity).toBeTypeOf('function')
        expect(layer_instance.stroke_opacity).toBeTypeOf('function')
        expect(layer_instance.opacity).toBeTypeOf('function')
        expect(layer_instance.opacity_percentage).toBeDefined()
        expect(layer_instance.selected_layer).toBeDefined()
        expect(layer_instance.get_active_layer).toBeTypeOf('function')
      })
    })
  })
})
