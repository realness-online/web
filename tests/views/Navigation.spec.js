import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Navigation from '@/views/Navigation'

describe('@/views/Navigation', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Navigation)
  })

  describe('Renders', () => {
    it('renders navigation component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  // Split into separate describe blocks to reduce nesting
  describe('Navigation Events', () => {
    it('handles back navigation', () => {
      wrapper.vm.handle_back()
      expect(wrapper.emitted('back')).toBeTruthy()
    })

    it('handles forward navigation', () => {
      wrapper.vm.handle_forward()
      expect(wrapper.emitted('forward')).toBeTruthy()
    })
  })

  describe('URL Management', () => {
    it('updates current url', () => {
      const test_url = '/test'
      wrapper.vm.update_current_url(test_url)
      expect(wrapper.vm.current_url).toBe(test_url)
    })

    it('tracks navigation history', () => {
      const test_url = '/test'
      wrapper.vm.update_history(test_url)
      expect(wrapper.vm.history).toContain(test_url)
    })
  })

  describe('Browser Integration', () => {
    it('handles browser back button', () => {
      vi.spyOn(window.history, 'back')
      wrapper.vm.browser_back()
      expect(window.history.back).toHaveBeenCalled()
    })

    it('handles browser forward button', () => {
      vi.spyOn(window.history, 'forward')
      wrapper.vm.browser_forward()
      expect(window.history.forward).toHaveBeenCalled()
    })
  })

  describe('History Management', () => {
    it('clears navigation history', () => {
      wrapper.vm.history = ['/test1', '/test2']
      wrapper.vm.clear_history()
      expect(wrapper.vm.history).toHaveLength(0)
    })
  })
})
