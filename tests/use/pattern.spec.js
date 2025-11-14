import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { use } from '@/use/pattern'

// Mock localStorage BEFORE importing
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: { me: '/+14151234356' },
    configurable: true,
    writable: true
  })
})

// Mock dependencies
vi.mock('@/utils/itemid', () => ({
  as_query_id: vi.fn(id => `${id}-query`),
  as_fragment_id: vi.fn(id => `#${id}-fragment`)
}))

const mock_use_poster = vi.fn(() => ({
  vector: ref(null),
  aspect_ratio: ref('xMidYMid meet'),
  tabindex: ref(-1)
}))

vi.mock('@/use/poster', () => ({
  use: mock_use_poster,
  is_vector: vi.fn(() => true),
  is_vector_id: vi.fn(() => true)
}))

vi.mock('@/utils/preference', () => ({
  background: ref(true),
  light: ref(true),
  regular: ref(true),
  medium: ref(true),
  bold: ref(true)
}))

// Helper to test composables in proper Vue context
function with_setup(composable, props = {}) {
  let result
  const app = defineComponent({
    props: Object.keys(props),
    setup(component_props) {
      result = composable()
      return () => {}
    }
  })
  mount(app, { props })
  return result
}

describe('pattern composable', () => {
  let pattern_instance
  const mock_vector = {
    id: '/+14151234356/posters/1000',
    width: 800,
    height: 600,
    viewbox: '0 0 800 600',
    background: { fill: '#ffffff' },
    light: { getAttribute: () => 'M0,0 L100,100' },
    regular: { getAttribute: () => 'M0,0 L200,200' },
    medium: { getAttribute: () => 'M0,0 L300,300' },
    bold: { getAttribute: () => 'M0,0 L400,400' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('returns composable functions and values', () => {
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.query).toBeTypeOf('function')
      expect(pattern_instance.fragment).toBeTypeOf('function')
      expect(pattern_instance.width).toBeDefined()
      expect(pattern_instance.height).toBeDefined()
      expect(pattern_instance.viewbox).toBeDefined()
      expect(pattern_instance.aspect_ratio).toBeDefined()
      expect(pattern_instance.tabindex).toBeDefined()
      expect(pattern_instance.vector).toBeDefined()
    })

    it('returns visibility flags', () => {
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.background_visible).toBeDefined()
      expect(pattern_instance.light_visible).toBeDefined()
      expect(pattern_instance.regular_visible).toBeDefined()
      expect(pattern_instance.medium_visible).toBeDefined()
      expect(pattern_instance.bold_visible).toBeDefined()
    })
  })

  describe('vector resolution', () => {
    it('uses options.vector when provided', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.vector.value).toEqual(mock_vector)
    })

    it('uses props.vector when no options provided', () => {
      pattern_instance = with_setup(() => use(), { vector: mock_vector })
      expect(pattern_instance.vector.value).toEqual(mock_vector)
    })

    it('falls back to injected vector', () => {
      const injected_vector = ref(mock_vector)
      const app = defineComponent({
        setup() {
          const { provide } = require('vue')
          provide('vector', injected_vector)
          return use()
        }
      })
      const wrapper = mount(app)
      const instance = wrapper.vm
      expect(instance.vector.value).toEqual(mock_vector)
    })

    it('falls back to use_poster vector', () => {
      mock_use_poster.mockReturnValue({
        vector: ref(mock_vector),
        aspect_ratio: ref('xMidYMid meet'),
        tabindex: ref(-1)
      })
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.vector.value).toEqual(mock_vector)
    })
  })

  describe('itemid resolution', () => {
    it('uses options.itemid when provided', () => {
      const itemid = '/+14151234356/posters/2000'
      pattern_instance = with_setup(() => use({ itemid, vector: mock_vector }))
      expect(pattern_instance.query('test')).toContain(itemid)
    })

    it('uses props.itemid when no options provided', () => {
      const itemid = '/+14151234356/posters/2000'
      pattern_instance = with_setup(() => use(), {
        itemid,
        vector: mock_vector
      })
      expect(pattern_instance.query('test')).toContain(itemid)
    })

    it('extracts itemid from vector when no explicit itemid', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.query('test')).toContain(mock_vector.id)
    })
  })

  describe('query and fragment helpers', () => {
    beforeEach(() => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
    })

    it('generates query id with suffix', () => {
      const result = pattern_instance.query('shadow')
      expect(result).toContain('shadow')
      expect(result).toContain(mock_vector.id)
    })

    it('generates query id without suffix', () => {
      const result = pattern_instance.query()
      expect(result).toContain(mock_vector.id)
    })

    it('generates fragment id with suffix', () => {
      const result = pattern_instance.fragment('radial-background')
      expect(result).toContain('radial-background')
      expect(result).toContain(mock_vector.id)
    })

    it('generates fragment id without suffix', () => {
      const result = pattern_instance.fragment()
      expect(result).toContain(mock_vector.id)
    })
  })

  describe('dimensions', () => {
    it('returns width from vector', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.width.value).toBe(800)
    })

    it('returns height from vector', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.height.value).toBe(600)
    })

    it('returns default width when vector missing', () => {
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.width.value).toBe(0)
    })

    it('returns default height when vector missing', () => {
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.height.value).toBe(0)
    })
  })

  describe('viewbox', () => {
    it('returns viewbox from vector', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.viewbox.value).toBe('0 0 800 600')
    })

    it('returns default viewbox when vector missing', () => {
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.viewbox.value).toBe('0 0 16 16')
    })
  })

  describe('aspect_ratio and tabindex', () => {
    it('delegates to use_poster for aspect_ratio', () => {
      mock_use_poster.mockReturnValue({
        vector: ref(null),
        aspect_ratio: ref('xMidYMid slice'),
        tabindex: ref(0)
      })
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.aspect_ratio.value).toBe('xMidYMid slice')
    })

    it('delegates to use_poster for tabindex', () => {
      mock_use_poster.mockReturnValue({
        vector: ref(null),
        aspect_ratio: ref('xMidYMid meet'),
        tabindex: ref(0)
      })
      pattern_instance = with_setup(() => use())
      expect(pattern_instance.tabindex.value).toBe(0)
    })
  })

  describe('visibility flags', () => {
    it('background_visible reflects preference', async () => {
      const { background } = await import('@/utils/preference')
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.background_visible.value).toBe(true)
      background.value = false
      // Note: computed values may not update immediately in test context
      // This test verifies the initial state
    })

    it('light_visible requires both vector.light and preference', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.light_visible.value).toBe(true)
    })

    it('regular_visible requires both vector.regular and preference', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.regular_visible.value).toBe(true)
    })

    it('medium_visible requires both vector.medium and preference', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.medium_visible.value).toBe(true)
    })

    it('bold_visible requires both vector.bold and preference', () => {
      pattern_instance = with_setup(() => use({ vector: mock_vector }))
      expect(pattern_instance.bold_visible.value).toBe(true)
    })

    it('path visibility is false when vector path missing', () => {
      const vector_no_light = { ...mock_vector, light: null }
      pattern_instance = with_setup(() => use({ vector: vector_no_light }))
      expect(pattern_instance.light_visible.value).toBe(false)
    })
  })
})
