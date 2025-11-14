import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
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
    posters: { value: [{
      id: '/+14151234356/posters/1234567890',
      type: 'poster',
      viewbox: '0 0 100 100'
    }] },
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
})
