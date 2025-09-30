import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
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
    posters: { value: [] },
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
        stubs: {
          icon: true,
          'as-figure': true,
          'as-svg': true,
          'as-menu-author': true,
          'logo-as-link': true
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
