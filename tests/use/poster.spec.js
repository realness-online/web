import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  is_vector_id,
  is_vector,
  is_click,
  is_focus,
  is_rect,
  is_stop,
  is_url_query,
  set_vector_dimensions,
  geology_layers,
  use_posters
} from '@/use/poster'
import { as_directory } from '@/persistance/Directory'
import { as_author, as_created_at } from '@/utils/itemid'
import { load } from '@/utils/itemid'
import { recent_item_first } from '@/utils/sorting'

vi.mock('@/persistance/Directory')
vi.mock('@/utils/itemid')
vi.mock('@/utils/sorting')

// Helper to test composables in proper Vue context
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

describe('poster utils', () => {
  describe('is_vector_id', () => {
    it('returns true for valid itemid with created_at', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      expect(is_vector_id('/user/posters/1234567890')).toBe(true)
    })

    it('returns false for itemid without created_at', () => {
      vi.mocked(as_created_at).mockReturnValue(null)
      expect(is_vector_id('/user/posters')).toBe(false)
    })
  })

  describe('is_vector', () => {
    it('returns true for valid poster object', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'posters',
        viewbox: '0 0 100 100',
        width: 100,
        height: 100
      }
      expect(is_vector(vector)).toBe(true)
    })

    it('returns false for non-object', () => {
      expect(is_vector(null)).toBe(false)
      expect(is_vector(undefined)).toBe(false)
      expect(is_vector('string')).toBe(false)
      expect(is_vector(123)).toBe(false)
    })

    it('returns false for object with path property', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'posters',
        path: 'some-path',
        viewbox: '0 0 100 100',
        width: 100,
        height: 100
      }
      expect(is_vector(vector)).toBe(false)
    })

    it('returns false for object without viewbox', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'posters',
        width: 100,
        height: 100
      }
      expect(is_vector(vector)).toBe(false)
    })

    it('returns false for object without width or height', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'posters',
        viewbox: '0 0 100 100'
      }
      expect(is_vector(vector)).toBe(false)
    })

    it('validates gradients if present', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector_with_gradients = {
        id: '/user/posters/1234567890',
        type: 'posters',
        viewbox: '0 0 100 100',
        width: 100,
        height: 100,
        gradients: {
          width: 100,
          height: 100,
          radial: true
        }
      }
      expect(is_vector(vector_with_gradients)).toBe(true)
    })

    it('returns false for invalid gradients', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector_invalid_gradients = {
        id: '/user/posters/1234567890',
        type: 'posters',
        viewbox: '0 0 100 100',
        width: 100,
        height: 100,
        gradients: {
          width: 100,
          height: 100
        }
      }
      expect(is_vector(vector_invalid_gradients)).toBe(false)
    })

    it('returns false for wrong type', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'statements',
        viewbox: '0 0 100 100',
        width: 100,
        height: 100
      }
      expect(is_vector(vector)).toBe(false)
    })
  })

  describe('is_click', () => {
    it('returns true for boolean values', () => {
      expect(is_click(true)).toBe(true)
      expect(is_click(false)).toBe(true)
    })

    it('returns false for non-boolean values', () => {
      expect(is_click('string')).toBe(false)
      expect(is_click(123)).toBe(false)
      expect(is_click(null)).toBe(false)
      expect(is_click(undefined)).toBe(false)
    })
  })

  describe('is_focus', () => {
    it('returns true for valid path names', () => {
      expect(is_focus('background')).toBe(true)
      expect(is_focus('light')).toBe(true)
      expect(is_focus('regular')).toBe(true)
      expect(is_focus('medium')).toBe(true)
      expect(is_focus('bold')).toBe(true)
    })

    it('returns false for invalid path names', () => {
      expect(is_focus('invalid')).toBe(false)
      expect(is_focus('')).toBe(false)
      expect(is_focus(null)).toBe(false)
    })
  })

  describe('is_rect', () => {
    it('returns true for null or undefined', () => {
      expect(is_rect(null)).toBe(true)
      expect(is_rect(undefined)).toBe(true)
    })

    it('returns true for SVGRectElement', () => {
      const mock_rect = {
        constructor: { name: 'SVGRectElement' }
      }
      Object.setPrototypeOf(mock_rect, SVGRectElement.prototype)
      expect(is_rect(mock_rect)).toBe(true)
    })

    it('returns false for non-object', () => {
      expect(is_rect('string')).toBe(false)
      expect(is_rect(123)).toBe(false)
    })

    it('returns false for regular object', () => {
      expect(is_rect({})).toBe(false)
    })
  })

  describe('is_stop', () => {
    it('returns true for SVGStopElement', () => {
      const mock_stop = {
        constructor: { name: 'SVGStopElement' }
      }
      Object.setPrototypeOf(mock_stop, SVGStopElement.prototype)
      expect(is_stop(mock_stop)).toBe(true)
    })

    it('returns false for non-object', () => {
      expect(is_stop('string')).toBe(false)
      expect(is_stop(123)).toBe(false)
      expect(is_stop(null)).toBe(false)
    })
  })

  describe('is_url_query', () => {
    it('returns true for valid url() query', () => {
      expect(is_url_query('url(#gradient)')).toBe(true)
      expect(is_url_query('url(#test)')).toBe(true)
    })

    it('returns false for non-string', () => {
      expect(is_url_query(123)).toBe(false)
      expect(is_url_query(null)).toBe(false)
      expect(is_url_query(undefined)).toBe(false)
    })

    it('returns false for invalid url() format', () => {
      expect(is_url_query('url(#test')).toBe(false)
    })

    it('returns true for strings that do not start with url(', () => {
      expect(is_url_query('not-url(#test)')).toBe(true)
      expect(is_url_query('anything')).toBe(true)
    })
  })

  describe('set_vector_dimensions', () => {
    it('sets viewbox, width, and height from element attributes', () => {
      const props = {}
      const mock_element = {
        getAttribute: vi.fn(attr => {
          if (attr === 'viewBox') return '0 0 200 150'
          if (attr === 'width') return '200'
          if (attr === 'height') return '150'
          return null
        })
      }

      set_vector_dimensions(props, mock_element)

      expect(props.viewbox).toBe('0 0 200 150')
      expect(props.width).toBe('200')
      expect(props.height).toBe('150')
    })

    it('uses viewbox dimensions when width/height not set', () => {
      const props = {}
      const mock_element = {
        getAttribute: vi.fn(attr => {
          if (attr === 'viewBox') return '0 0 300 200'
          return null
        })
      }

      set_vector_dimensions(props, mock_element)

      expect(props.viewbox).toBe('0 0 300 200')
      expect(props.width).toBe('300')
      expect(props.height).toBe('200')
    })
  })

  describe('geology_layers', () => {
    it('exports correct layer order', () => {
      expect(geology_layers).toEqual([
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ])
    })
  })

  describe('use_posters', () => {
    let posters_composable

    beforeEach(() => {
      vi.clearAllMocks()
      posters_composable = with_setup(use_posters)
    })

    describe('for_person', () => {
      it('adds posters from directory to posters array', async () => {
        const mock_query = { id: '/user' }
        const mock_directory = {
          items: ['1234567890', '0987654321']
        }

        vi.mocked(as_directory).mockResolvedValue(mock_directory)

        await posters_composable.for_person(mock_query)

        expect(posters_composable.posters.value).toHaveLength(2)
        expect(posters_composable.posters.value[0].id).toBe(
          '/user/posters/1234567890'
        )
        expect(posters_composable.posters.value[1].id).toBe(
          '/user/posters/0987654321'
        )
      })

      it('does not add duplicate posters', async () => {
        const mock_query = { id: '/user' }
        const mock_directory = {
          items: ['1234567890']
        }

        vi.mocked(as_directory).mockResolvedValue(mock_directory)

        await posters_composable.for_person(mock_query)
        await posters_composable.for_person(mock_query)

        expect(posters_composable.posters.value).toHaveLength(1)
      })

      it('sorts posters by recent first', async () => {
        const mock_query = { id: '/user' }
        const mock_directory = {
          items: ['1234567890', '0987654321']
        }

        vi.mocked(as_directory).mockResolvedValue(mock_directory)
        vi.mocked(recent_item_first).mockImplementation((a, b) => {
          return a.id.localeCompare(b.id)
        })

        await posters_composable.for_person(mock_query)

        expect(recent_item_first).toHaveBeenCalled()
      })
    })

    describe('poster_shown', () => {
      it('is a function', () => {
        expect(posters_composable.poster_shown).toBeTypeOf('function')
      })
    })
  })
})
