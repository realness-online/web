import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '@/App.vue'

describe('App.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(App)
  })

  describe('Rendering', () => {
    it('renders app container', () => {
      expect(wrapper.find('#app').exists()).toBe(true)
    })

    it('renders navigation', () => {
      expect(wrapper.find('nav').exists()).toBe(true)
    })

    it('renders main content', () => {
      expect(wrapper.find('main').exists()).toBe(true)
    })
  })

  describe('Navigation', () => {
    it('shows correct nav items', () => {
      const nav_items = wrapper.findAll('nav a')
      expect(nav_items.length).toBeGreaterThan(0)
    })

    it('handles nav item clicks', async () => {
      const nav_item = wrapper.find('nav a')
      await nav_item.trigger('click')
      expect(wrapper.emitted('navigate')).toBeTruthy()
    })
  })

  describe('Route Handling', () => {
    it('updates on route change', async () => {
      await wrapper.vm.handle_route_change({ path: '/test' })
      expect(wrapper.vm.current_route).toBe('/test')
    })

    it('handles invalid routes', async () => {
      await wrapper.vm.handle_route_change({ path: null })
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('State Management', () => {
    it('updates app state', async () => {
      await wrapper.vm.update_state({ loading: true })
      expect(wrapper.vm.is_loading).toBe(true)
    })

    it('handles state errors', async () => {
      const error_state = { error: 'Test error' }
      await wrapper.vm.update_state(error_state)
      expect(wrapper.vm.error).toBe(error_state.error)
    })
  })
})
