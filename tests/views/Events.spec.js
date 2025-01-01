import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Events from '@/views/Events'

describe('@/views/Events', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Events)
  })

  describe('Rendering', () => {
    it('renders events component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Event Management', () => {
    it('adds new event', () => {
      const test_event = {
        title: 'Test Event',
        date: vi.fn().mockReturnValue(new Date())
      }
      wrapper.vm.add_event(test_event)
      expect(wrapper.vm.events).toContain(test_event)
    })
  })
})
