import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import PhoneBook from '@/views/PhoneBook'

const MOCK_YEAR = 2000
const MOCK_MONTH = 13

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

// Mock people composable
vi.mock('@/use/people', () => ({
  use: () => ({
    phonebook: { value: [{
      id: '/+14151234567',
      type: 'person',
      name: { given: 'Test', family: 'User' }
    }] },
    load_phonebook: vi.fn(),
    working: { value: false }
  }),
  use_me: () => ({
    relations: { value: [] }
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

describe('@/views/PhoneBook', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(MOCK_YEAR, MOCK_MONTH))
    wrapper = shallowMount(PhoneBook, {
      global: {
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-figure': {
            template: '<div class="profile-stub"></div>',
            props: ['person']
          },
          'sign-on': true,
          'router-link': true
        }
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Renders', () => {
    it('renders phone book view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#directory').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Phonebook')
    })
  })
})
