import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Relations from '@/views/Relations.vue'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

// Mock people composable
vi.mock('@/use/people', () => ({
  use_me: () => ({
    relations: {
      value: [
        {
          id: '/+14151234567',
          type: 'person',
          name: { given: 'Test', family: 'User' }
        }
      ]
    }
  }),
  use: () => ({
    people: {
      value: [
        {
          id: '/+14151234567',
          type: 'person',
          name: { given: 'Test', family: 'User' }
        }
      ]
    },
    load_people: vi.fn()
  }),
  is_person: maybe => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))

// Mock serverless utils
vi.mock('@/utils/serverless', () => ({
  current_user: { value: null }
}))

describe('Relations', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Relations, {
      global: {
        stubs: {
          icon: true,
          'as-figure': {
            template: '<div class="profile-stub"></div>',
            props: ['person']
          },
          'router-link': true
        }
      }
    })
  })

  it('renders relations view', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#relations').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
    })
  })
})
