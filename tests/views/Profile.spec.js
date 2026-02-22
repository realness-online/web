import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Profile from '@/views/Profile.vue'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { phone_number: '4151234356' }
  })
}))

// Mock people composable
vi.mock('@/use/people', () => ({
  use: () => ({
    people: { value: [] },
    load_people: vi.fn(),
    load_person: vi.fn()
  }),
  from_e64: vi.fn().mockReturnValue('/+14151234356'),
  is_person: maybe => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))

// Mock thought composable
vi.mock('@/use/thought', () => ({
  use: () => ({
    thoughts: [],
    for_person: vi.fn()
  }),
  slot_key: vi.fn()
}))

// Mock poster composable
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: [],
    for_person: vi.fn()
  }),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_svg_valid: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

describe('Profile', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Profile, {
      global: {
        stubs: {
          'as-days': true,
          'logo-as-link': true,
          'download-vector': true,
          'as-figure': true,
          'as-svg': true,
          'as-messenger': true,
          'as-article': true,
          'as-figure': true,
          icon: true,
          'router-link': true
        }
      }
    })
  })

  it('renders profile view', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#profile').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
    })
  })
})
