import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Sign_on from '@/views/Sign-on.vue'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356',
    length: 0
  }
})

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  keys: vi.fn().mockResolvedValue([]),
  clear: vi.fn().mockResolvedValue()
}))

// Mock utils/itemid
vi.mock('@/utils/itemid', () => ({
  load: vi.fn().mockResolvedValue({})
}))

// Mock utils/serverless
vi.mock('@/utils/serverless', () => ({
  current_user: { value: null }
}))

// Mock people composable
vi.mock('@/use/people', () => ({
  use_me: () => ({
    me: { value: null },
    is_valid_name: { value: false }
  }),
  default_person: { id: '/+14151234356', type: 'person' },
  is_person: maybe => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('Sign-on', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Sign_on, {
      global: {
        stubs: {
          'logo-as-link': true,
          'profile-as-figure': true,
          'mobile-as-form': true,
          'name-as-form': true
        }
      }
    })
  })

  describe('initial render', () => {
    it('renders sign-on component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#sign-on').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
    })
  })
})
