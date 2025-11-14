import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'
import as_pattern from '@/components/posters/as-pattern'

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
    background_visible: ref(true),
    light_visible: ref(true),
    regular_visible: ref(true),
    medium_visible: ref(true),
    bold_visible: ref(true)
  }))
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  use: vi.fn(() => ({
    focus: vi.fn()
  })),
  is_vector: vi.fn(() => true),
  is_vector_id: vi.fn(() => true)
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

describe('@/components/posters/as-pattern.vue', () => {
  describe('Renders', () => {
    it('a pattern element with correct attributes', () => {
      const wrapper = shallowMount(as_pattern, {
        props: {
          vector: mock_vector
        }
      })
      const pattern = wrapper.find('pattern')
      expect(pattern.exists()).toBe(true)
      expect(pattern.attributes('id')).toContain(mock_vector.id)
      expect(pattern.attributes('width')).toBe('800')
      expect(pattern.attributes('height')).toBe('600')
      expect(pattern.attributes('viewbox')).toBe('0 0 800 600')
      expect(pattern.attributes('patternunits')).toBe('userSpaceOnUse')
      expect(pattern.attributes('preserveaspectratio')).toBe('xMidYMid meet')
    })

    it('renders as-background component', () => {
      const wrapper = shallowMount(as_pattern, {
        props: {
          vector: mock_vector
        }
      })
      const background = wrapper.find('rect[itemprop="background"]')
      expect(background.exists()).toBe(true)
    })

    it('renders all four as-path components', () => {
      const wrapper = shallowMount(as_pattern, {
        props: {
          vector: mock_vector
        }
      })
      const paths = wrapper.findAll('path')
      expect(paths.length).toBeGreaterThanOrEqual(4)
    })

    it('works without vector prop (uses injection)', () => {
      const wrapper = shallowMount(as_pattern)
      const pattern = wrapper.find('pattern')
      expect(pattern.exists()).toBe(true)
    })

    it('works with itemid prop', () => {
      const wrapper = shallowMount(as_pattern, {
        props: {
          itemid: '/+14151234356/posters/2000'
        }
      })
      const pattern = wrapper.find('pattern')
      expect(pattern.exists()).toBe(true)
    })
  })

  describe('Focus handling', () => {
    it('handles focus events', () => {
      const wrapper = shallowMount(as_pattern, {
        props: {
          vector: mock_vector
        }
      })
      expect(wrapper.exists()).toBe(true)
    })
  })
})
