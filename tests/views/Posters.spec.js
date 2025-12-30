import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount, mount } from '@vue/test-utils'
import { ref } from 'vue'
import Posters from '@/views/Posters'

const MOCK_YEAR = 2020

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

// Mock key-commands composable
vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn()
  })
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: {
      value: [
        {
          id: '/+14151234356/posters/1234567890',
          type: 'poster',
          viewbox: '0 0 100 100'
        }
      ]
    },
    for_person: vi.fn(),
    poster_shown: vi.fn()
  }),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

// Mock vectorize composable
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    can_add: { value: true },
    select_photo: vi.fn(),
    working: { value: false }
  })
}))

// Mock directory-processor composable
vi.mock('@/use/directory-processor', () => ({
  use: () => ({
    process_directory: vi.fn(),
    progress: { value: 0 },
    completed_poster: { value: null }
  })
}))

// Mock persistance/Storage
vi.mock('@/persistance/Storage', () => ({
  Poster: vi.fn().mockImplementation(id => ({
    id,
    delete: vi.fn()
  }))
}))

// Mock preference utils
vi.mock('@/utils/preference', () => ({
  storytelling: { value: false },
  slice: { value: false }
}))

// Mock utils/itemid
vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(),
  load: vi.fn().mockResolvedValue({})
}))

// Mock utils/date
vi.mock('@/utils/date', () => ({
  as_day_time_year: vi.fn()
}))

describe('@/views/Posters', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Posters, {
      global: {
        provide: {
          select_photo: vi.fn(),
          can_add: ref(true),
          init_processing_queue: vi.fn(() => Promise.resolve()),
          queue_items: ref([])
        },
        stubs: {
          icon: true,
          'as-figure': {
            template: '<div class="poster-stub"></div>',
            props: ['itemid']
          },
          'as-svg': true,
          'as-menu-author': true,
          'logo-as-link': true,
          'as-svg-processing': true
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders posters view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#posters').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Posters')
    })
  })

  describe('Poster Management', () => {
    it('handles poster removal', async () => {
      const { load } = await import('@/utils/itemid')
      const mock_poster = { id: '/+14151234356/posters/1234567890' }
      load.mockResolvedValueOnce(mock_poster)

      const mounted_wrapper = mount(Posters, {
        global: {
          provide: {
            select_photo: vi.fn(),
            can_add: ref(true),
            init_processing_queue: vi.fn(() => Promise.resolve()),
            queue_items: ref([])
          },
          stubs: {
            icon: true,
            'as-figure': {
              template: '<div class="poster-stub"></div>',
              props: ['itemid']
            },
            'as-svg': true,
            'as-menu-author': true,
            'logo-as-link': true,
            'as-svg-processing': true
          }
        }
      })

      await mounted_wrapper.vm.remove_poster(mock_poster.id)
      await mounted_wrapper.vm.$nextTick()

      expect(load).toHaveBeenCalledWith(mock_poster.id)
      expect(mounted_wrapper.vm.poster_to_remove).toEqual(mock_poster)
      const dialog = mounted_wrapper.find('dialog')
      expect(dialog.exists()).toBe(true)

      mounted_wrapper.unmount()
    })

    it('handles confirmed removal', async () => {
      const { Poster } = await import('@/persistance/Storage')
      const { use_posters } = await import('@/use/poster')
      const mock_poster = { id: '/+14151234356/posters/1234567890' }
      wrapper.vm.poster_to_remove = mock_poster
      wrapper.vm.delete_dialog = { close: vi.fn() }
      const posters = use_posters().posters
      const initial_length = posters.value.length
      posters.value = [
        { id: '/+14151234356/posters/1234567890', type: 'posters' },
        { id: '/+14151234356/posters/0987654321', type: 'posters' }
      ]

      wrapper.vm.confirmed_remove()
      await wrapper.vm.$nextTick()

      expect(posters.value.length).toBeLessThan(initial_length + 2)
      expect(Poster).toHaveBeenCalledWith(mock_poster.id)
    })

    it('handles cancel removal', () => {
      wrapper.vm.delete_dialog = { close: vi.fn() }
      wrapper.vm.cancel_remove()
      expect(wrapper.vm.delete_dialog.close).toHaveBeenCalled()
    })

    it('toggles menu for poster', async () => {
      const poster1 = { id: '/+14151234356/posters/1', menu: false, type: 'posters' }
      const poster2 = { id: '/+14151234356/posters/2', menu: true, type: 'posters' }
      wrapper.vm.posters.value = [poster1, poster2]

      wrapper.vm.toggle_menu('/+14151234356/posters/1')
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const found1 = wrapper.vm.posters.value.find(p => p.id === '/+14151234356/posters/1')
      const found2 = wrapper.vm.posters.value.find(p => p.id === '/+14151234356/posters/2')
      expect(found1).toBeTruthy()
      expect(found1.menu).toBe(true)
      expect(found2).toBeTruthy()
      expect(found2.menu).toBe(false)
    })

    it('focuses poster element', () => {
      const mock_svg = document.createElement('svg')
      mock_svg.setAttribute('itemid', '/+14151234356/posters/1')
      const mock_figure = document.createElement('figure')
      mock_figure.className = 'poster'
      mock_figure.tabIndex = 0
      mock_figure.appendChild(mock_svg)
      document.body.appendChild(mock_figure)

      wrapper.vm.focus_poster('/+14151234356/posters/1')
      expect(document.activeElement).toBe(mock_figure)

      document.body.removeChild(mock_figure)
    })

    it('handles poster click', async () => {
      const poster = { id: '/+14151234356/posters/1', menu: false, type: 'posters' }
      wrapper.vm.posters.value = [poster]

      const mock_svg = document.createElement('svg')
      mock_svg.setAttribute('itemid', '/+14151234356/posters/1')
      const mock_figure = document.createElement('figure')
      mock_figure.className = 'poster'
      mock_figure.appendChild(mock_svg)
      document.body.appendChild(mock_figure)

      wrapper.vm.handle_poster_click('/+14151234356/posters/1')
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const found = wrapper.vm.posters.value.find(p => p.id === '/+14151234356/posters/1')
      expect(found).toBeTruthy()
      expect(found.menu).toBe(true)

      document.body.removeChild(mock_figure)
    })

    it('toggles picker for poster', async () => {
      const poster = { id: '/+14151234356/posters/1', picker: false, type: 'posters' }
      wrapper.vm.posters.value = [poster]

      wrapper.vm.picker('/+14151234356/posters/1')
      await wrapper.vm.$nextTick()

      const found = wrapper.vm.posters.value.find(p => p.id === '/+14151234356/posters/1')
      expect(found).toBeTruthy()
      expect(found).toHaveProperty('picker')
      expect(found.picker).toBe(true)
    })

    it('handles dialog click to close', () => {
      wrapper.vm.delete_dialog = { close: vi.fn() }
      const mock_event = {
        target: wrapper.vm.delete_dialog
      }

      wrapper.vm.dialog_click(mock_event)
      expect(wrapper.vm.delete_dialog.close).toHaveBeenCalled()
    })

    it('does not close dialog when clicking inside', () => {
      wrapper.vm.delete_dialog = { close: vi.fn() }
      const mock_event = {
        target: document.createElement('div')
      }

      wrapper.vm.dialog_click(mock_event)
      expect(wrapper.vm.delete_dialog.close).not.toHaveBeenCalled()
    })
  })

  describe('Storytelling Mode', () => {
    it('handles focus in storytelling mode', async () => {
      const { storytelling } = await import('@/utils/preference')
      storytelling.value = true

      const mock_figure = document.createElement('figure')
      mock_figure.className = 'poster'
      const mock_article = document.createElement('article')
      mock_article.appendChild(mock_figure)
      mock_article.scrollTo = vi.fn()
      document.body.appendChild(mock_article)

      const mock_event = {
        target: mock_figure,
        target: {
          closest: vi.fn(selector => {
            if (selector === 'figure.poster') return mock_figure
            if (selector === 'article') return mock_article
            return null
          })
        }
      }

      wrapper.vm.handle_focus(mock_event)
      await wrapper.vm.$nextTick()

      expect(mock_article.scrollTo).toHaveBeenCalled()

      document.body.removeChild(mock_article)
    })

    it('does not handle focus when not in storytelling mode', async () => {
      const { storytelling } = await import('@/utils/preference')
      storytelling.value = false

      const mock_target = document.createElement('div')
      const mock_closest = vi.fn()
      mock_target.closest = mock_closest
      const mock_event = {
        target: mock_target
      }

      wrapper.vm.handle_focus(mock_event)
      await wrapper.vm.$nextTick()
      expect(mock_closest).not.toHaveBeenCalled()
    })
  })
})
