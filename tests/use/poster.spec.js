import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import {
  is_vector_id,
  is_vector,
  is_svg_valid,
  is_click,
  is_focus,
  is_rect,
  is_stop,
  is_url_query,
  set_vector_dimensions,
  geology_layers,
  use_posters,
  use as use_poster
} from '@/use/poster'
import { as_directory } from '@/persistence/Directory'
import {
  as_author,
  as_created_at,
  as_query_id,
  as_fragment_id
} from '@/utils/itemid'
import { load } from '@/utils/itemid'
import { recent_item_first } from '@/utils/sorting'

vi.mock('@/persistence/Directory')
vi.mock('@/utils/itemid')
vi.mock('@/utils/sorting')

const mock_get_active_path = vi.hoisted(() => vi.fn(() => null))

vi.mock('@/use/path', () => ({
  use: () => ({ get_active_path: mock_get_active_path })
}))
vi.mock('@/utils/preference', () => ({
  aspect_ratio_mode: { value: 'auto', __v_isRef: true },
  slice_alignment: { value: 'ymid', __v_isRef: true }
}))
vi.mock('@vueuse/core', () => ({
  usePointer: () => ({
    x: { value: 0 },
    y: { value: 0 },
    pressure: { value: 0.5 }
  })
}))

// Helper to test composables in proper Vue context
function with_setup(composable, { props = {}, provide = {} } = {}) {
  let result
  const app = defineComponent({
    props: {
      itemid: { type: String, default: '/+1/posters/1000' },
      tabable: { type: Boolean, default: false }
    },
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app, { props, global: { provide } })
  return result
}

describe('poster utils', () => {
  describe('is_svg_valid', () => {
    it('returns true for SVGSVGElement in document', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      document.body.appendChild(svg)
      expect(is_svg_valid(svg)).toBe(true)
      document.body.removeChild(svg)
    })

    it('returns true for detached SVGSVGElement (e.g. VTU without attachTo)', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      expect(is_svg_valid(svg)).toBe(true)
    })

    it('returns false for non-SVG', () => {
      expect(is_svg_valid(null)).toBe(false)
      expect(is_svg_valid(document.createElement('div'))).toBe(false)
    })
  })

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

    it('returns false when gradients are missing height', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      expect(
        is_vector({
          id: '/user/posters/1234567890',
          type: 'posters',
          viewbox: '0 0 100 100',
          width: 100,
          height: 100,
          gradients: { width: 100, radial: true }
        })
      ).toBe(false)
    })

    it('returns false when gradients are missing width', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      expect(
        is_vector({
          id: '/user/posters/1234567890',
          type: 'posters',
          viewbox: '0 0 100 100',
          width: 100,
          height: 100,
          gradients: { height: 100, radial: true }
        })
      ).toBe(false)
    })

    it('returns false for wrong type', () => {
      vi.mocked(as_created_at).mockReturnValue('1234567890')
      const vector = {
        id: '/user/posters/1234567890',
        type: 'thoughts',
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
    let set_working

    beforeEach(() => {
      vi.clearAllMocks()
      set_working = vi.fn()
      posters_composable = with_setup(use_posters, {
        provide: { set_working }
      })
      vi.mocked(as_author).mockImplementation(id => {
        if (!id || typeof id !== 'string') return null
        const parts = id.split('/').filter(Boolean)
        return parts[0]?.startsWith('+') || parts[0] === 'user'
          ? `/${parts[0]}`
          : null
      })
      vi.mocked(as_created_at).mockImplementation(id => {
        const parts = String(id).split('/').filter(Boolean)
        return parts[2] || null
      })
      vi.mocked(recent_item_first).mockImplementation((a, b) =>
        String(b.id).localeCompare(String(a.id))
      )
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
        expect(set_working).toHaveBeenCalledWith(true)
        expect(set_working).toHaveBeenCalledWith(false)
      })

      it('returns early when directory is missing', async () => {
        vi.mocked(as_directory).mockResolvedValue(null)

        await posters_composable.for_person({ id: '/user' })

        expect(posters_composable.posters.value).toHaveLength(0)
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

        await posters_composable.for_person(mock_query)

        expect(recent_item_first).toHaveBeenCalled()
      })
    })

    describe('poster_shown', () => {
      it('returns when poster has no author', async () => {
        vi.mocked(as_author).mockReturnValueOnce(null)
        await posters_composable.poster_shown({
          id: '/bad',
          type: 'posters'
        })
        expect(as_directory).not.toHaveBeenCalled()
      })

      it('returns when author has no posters loaded', async () => {
        await posters_composable.poster_shown({
          id: '/user/posters/1000',
          type: 'posters'
        })
        expect(as_directory).not.toHaveBeenCalled()
      })

      it('returns when shown poster is not the oldest', async () => {
        vi.mocked(as_directory).mockResolvedValue({
          items: ['2000', '1000'],
          archive: ['900']
        })
        await posters_composable.for_person({ id: '/user' })
        as_directory.mockClear()

        await posters_composable.poster_shown({
          id: '/user/posters/2000',
          type: 'posters'
        })

        expect(as_directory).not.toHaveBeenCalled()
      })

      it('is a function', () => {
        expect(posters_composable.poster_shown).toBeTypeOf('function')
      })
    })
  })

  describe('use()', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mock_get_active_path.mockClear()
      vi.mocked(as_query_id).mockImplementation(id =>
        String(id).replace(/\//g, '-').replace(/^\-/, '')
      )
      vi.mocked(as_fragment_id).mockImplementation(id => `#${as_query_id(id)}`)
      vi.mocked(load).mockResolvedValue(null)
    })

    it('exposes defaults and toggles menu on click', () => {
      const poster = with_setup(use_poster, {
        props: { itemid: '/+1/posters/1000', tabable: true }
      })

      expect(poster.working.value).toBe(true)
      expect(poster.menu.value).toBe(false)
      expect(poster.tabindex.value).toBe(0)
      expect(poster.viewbox.value).toBe('0 0 16 16')
      expect(poster.path.value).toBeNull()

      poster.click()
      expect(poster.menu.value).toBe(true)
    })

    it('loads vector on show and builds query fragments', async () => {
      const vector = {
        id: '/+1/posters/1000',
        type: 'posters',
        viewbox: '0 0 200 100',
        path: { id: 'p1' }
      }
      vi.mocked(load).mockResolvedValue(vector)

      const poster = with_setup(use_poster, {
        props: { itemid: '/+1/posters/1000' }
      })

      await poster.show()
      await flushPromises()

      expect(load).toHaveBeenCalledWith('/+1/posters/1000')
      expect(poster.vector.value).toEqual(vector)
      expect(poster.working.value).toBe(false)
      expect(poster.landscape.value).toBe(true)
      expect(poster.path.value).toEqual([vector.path])
      expect(poster.query('bg')).toContain('bg')
      expect(poster.fragment('bg')).toContain('bg')
      expect(poster.original_viewbox.value).toEqual({
        x: 0,
        y: 0,
        width: 200,
        height: 100
      })
    })

    it('wraps path arrays and ignores show when vector already set', async () => {
      const poster = with_setup(use_poster, {
        props: { itemid: '/+1/posters/1000' }
      })
      poster.vector.value = {
        id: '/+1/posters/1000',
        viewbox: '0 0 10 20',
        path: [{ id: 'a' }, { id: 'b' }]
      }
      poster.working.value = false

      expect(poster.path.value).toEqual([{ id: 'a' }, { id: 'b' }])
      await poster.show()
      expect(load).not.toHaveBeenCalled()
    })

    it('emits focus through get_active_path and clears hover on up', () => {
      const poster = with_setup(use_poster, {
        props: { itemid: '/+1/posters/1000' }
      })
      poster.is_hovered.value = true

      poster.focus('regular')
      expect(mock_get_active_path).toHaveBeenCalled()

      poster.up()
      expect(poster.is_hovered.value).toBe(false)

      poster.focus_cutout()
      poster.down()
      poster.move()
      poster.wheel()
      poster.reset()
      poster.touch_dist()
      poster.touch_start()
      poster.touch_move()
      poster.touch_end()
      poster.cutout_start()
      poster.cutout_end()
    })
  })
})
