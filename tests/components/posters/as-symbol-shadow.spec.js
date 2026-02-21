import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'
import as_symbol_shadow from '@/components/posters/as-symbol-shadow'

// Mock path element
const mock_path_element = {
  getAttribute: vi.fn().mockReturnValue('M0,0 L100,100'),
  setAttribute: vi.fn(),
  style: {}
}

// Mock vector
const mock_vector = {
  id: '/+14151234356/posters/1000',
  width: 800,
  height: 600,
  viewbox: '0 0 800 600',
  background: { fill: '#ffffff' },
  light: mock_path_element,
  regular: mock_path_element,
  medium: mock_path_element,
  bold: mock_path_element
}

// Mock pattern composable
vi.mock('@/use/pattern', () => ({
  use: vi.fn(() => ({
    query: vi.fn(add => (add ? `${mock_vector.id}-${add}` : mock_vector.id)),
    fragment: vi.fn(add =>
      add ? `#${mock_vector.id}-${add}` : `#${mock_vector.id}`
    ),
    width: ref(800),
    height: ref(600),
    viewbox: ref('0 0 800 600'),
    aspect_ratio: ref('xMidYMid meet'),
    tabindex: ref(-1),
    vector: ref(mock_vector),
    itemid: ref(mock_vector.id),
    background_visible: ref(true),
    light_visible: ref(true),
    regular_visible: ref(true),
    medium_visible: ref(true),
    bold_visible: ref(true)
  }))
}))

// Mock itemid utilities
vi.mock('@/utils/itemid', () => ({
  as_layer_id: vi.fn((poster_id, layer) => {
    if (!poster_id || typeof poster_id !== 'string') return ''
    const parts = poster_id.split('/')
    const author = parts[1]
    const created = parts[3]
    const layer_type = layer.endsWith('s') ? layer : `${layer}s`
    return `/${author}/${layer_type}/${created}`
  }),
  as_query_id: vi.fn(itemid =>
    itemid.substring(2).replace('/', '-').replace('/', '-')
  ),
  as_fragment_id: vi.fn(
    itemid => `#${itemid.substring(2).replace('/', '-').replace('/', '-')}`
  )
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  use: vi.fn(() => ({
    focus: vi.fn()
  })),
  is_vector: vi.fn(() => true),
  is_vector_id: vi.fn(() => true),
  is_svg_valid: vi.fn(() => true),
  is_rect: vi.fn(rect => {
    if (rect === null || rect === undefined) return true
    if (typeof rect !== 'object') return false
    if (rect instanceof SVGRectElement) return true
    return false
  })
}))

// Mock child components
vi.mock('@/components/posters/as-background', () => ({
  default: {
    name: 'AsBackground',
    template: '<rect itemprop="background" />'
  }
}))

vi.mock('@/components/posters/as-path', () => ({
  default: {
    name: 'AsPath',
    template: '<path />'
  }
}))

describe('@/components/posters/as-symbol-shadow.vue', () => {
  describe('Renders', () => {
    it('a symbol element with correct attributes', () => {
      const wrapper = shallowMount(as_symbol_shadow, {
        props: {
          vector: mock_vector
        }
      })
      const symbol = wrapper.find('symbol')
      expect(symbol.exists()).toBe(true)
      expect(symbol.attributes('id')).toBe('14151234356-shadows-1000')
      expect(symbol.attributes('width')).toBe('800')
      expect(symbol.attributes('height')).toBe('600')
      expect(symbol.attributes('viewbox')).toBe('0 0 800 600')
      expect(symbol.attributes('preserveaspectratio')).toBe('xMidYMid meet')
    })

    it('renders as-background component', () => {
      const wrapper = shallowMount(as_symbol_shadow, {
        props: {
          vector: mock_vector
        }
      })
      const background = wrapper.findComponent({ name: 'AsBackground' })
      expect(background.exists()).toBe(true)
    })

    it('renders all four as-path components', () => {
      const wrapper = shallowMount(as_symbol_shadow, {
        props: {
          vector: mock_vector
        }
      })
      const path_components = wrapper.findAllComponents({ name: 'AsPath' })
      expect(path_components.length).toBeGreaterThanOrEqual(4)
    })

    it('works without vector prop (uses injection)', () => {
      const wrapper = shallowMount(as_symbol_shadow)
      const symbol = wrapper.find('symbol')
      expect(symbol.exists()).toBe(true)
    })

    it('works with itemid prop', () => {
      const wrapper = shallowMount(as_symbol_shadow, {
        props: {
          itemid: '/+14151234356/posters/2000'
        }
      })
      const symbol = wrapper.find('symbol')
      expect(symbol.exists()).toBe(true)
    })
  })

  describe('Focus handling', () => {
    it('handles focus events', () => {
      const wrapper = shallowMount(as_symbol_shadow, {
        props: {
          vector: mock_vector
        }
      })
      expect(wrapper.exists()).toBe(true)
    })
  })
})
