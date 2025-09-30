import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Events from '@/views/Events'

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

// Mock utils/itemid
vi.mock('@/utils/itemid', () => ({
  list: vi.fn().mockResolvedValue([])
}))

// Mock utils/sorting
vi.mock('@/utils/sorting', () => ({
  recent_item_first: vi.fn()
}))

describe('@/views/Events', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Events, {
      global: {
        stubs: {
          'logo-as-link': true,
          'as-days': true,
          'as-figure': true,
          icon: true,
          'router-link': true
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders events component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#events').exists()).toBe(true)
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Events')
    })
  })
})
