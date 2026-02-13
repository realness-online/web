import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Navigation from '@/views/Navigation'

// Mock the composable
const mock_open_camera = vi.fn()
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    open_camera: mock_open_camera
  })
}))

describe('@/views/Navigation', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Navigation, {
      global: {
        provide: {
          open_camera: mock_open_camera
        },
        stubs: {
          'router-link': true,
          icon: true,
          'statement-as-textarea': {
            template: '<textarea class="red"></textarea>',
            emits: ['toggle-keyboard']
          }
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders navigation section with correct id', () => {
      expect(wrapper.find('#navigation').exists()).toBe(true)
      expect(wrapper.find('#navigation').classes()).toContain('page')
    })

    it('renders nav element', () => {
      expect(wrapper.find('nav').exists()).toBe(true)
    })

    it('renders footer element', () => {
      expect(wrapper.find('footer').exists()).toBe(true)
    })

    it('renders router links for navigation', () => {
      const router_links = wrapper.findAll('router-link-stub')
      expect(router_links.length).toBeGreaterThan(0)

      // Check for specific routes
      const statements_link = router_links.find(
        link => link.attributes('to') === '/statements'
      )
      const events_link = router_links.find(
        link => link.attributes('to') === '/events'
      )
      const posters_link = router_links.find(
        link => link.attributes('to') === '/posters'
      )
      const phonebook_link = router_links.find(
        link => link.attributes('to') === '/phonebook'
      )
      const thoughts_link = router_links.find(
        link => link.attributes('to') === '/thoughts'
      )
      const about_link = router_links.find(
        link => link.attributes('to') === '/about'
      )

      expect(statements_link).toBeTruthy()
      expect(events_link).toBeTruthy()
      expect(posters_link).toBeTruthy()
      expect(phonebook_link).toBeTruthy()
      expect(thoughts_link).toBeTruthy()
      expect(about_link).toBeTruthy()
    })

    it('renders statement textarea component', () => {
      const textarea = wrapper.find('as-textarea-stub')
      expect(textarea.exists()).toBe(true)
    })

    it('renders camera button', () => {
      const camera_button = wrapper.find('#camera')
      expect(camera_button.exists()).toBe(true)
      expect(camera_button.find('icon-stub').exists()).toBe(true)
    })
  })

  describe('Posting State', () => {
    it('shows posting class when posting is true', async () => {
      wrapper.vm.posting = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#navigation').classes()).toContain('posting')
    })

    it('hides posting class when posting is false', async () => {
      wrapper.vm.posting = false
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#navigation').classes()).not.toContain('posting')
    })

    it('hides router links when posting', async () => {
      // First check links exist when not posting
      const initial_links_count = wrapper.findAll('router-link-stub').length
      expect(initial_links_count).toBeGreaterThan(0)

      // Set posting to true
      wrapper.vm.posting = true
      await wrapper.vm.$nextTick()

      // Most links should be hidden when posting (v-if="!posting"), but about link remains
      const router_links = wrapper.findAll('router-link-stub')
      expect(router_links.length).toBe(1) // Only the about link
      expect(router_links[0].attributes('id')).toBe('about')
    })

    it('hides footer when posting', async () => {
      wrapper.vm.posting = true
      await wrapper.vm.$nextTick()
      const footer = wrapper.find('footer')
      expect(footer.exists()).toBe(false) // Footer should be hidden when posting
    })
  })

  describe('Toggle Keyboard Functionality', () => {
    it('toggles posting state', async () => {
      expect(wrapper.vm.posting).toBe(false)

      await wrapper.vm.toggle_keyboard()
      expect(wrapper.vm.posting).toBe(true)

      await wrapper.vm.toggle_keyboard()
      expect(wrapper.vm.posting).toBe(false)
    })

    it('handles toggle-keyboard event from textarea', async () => {
      const textarea = wrapper.find('as-textarea-stub')
      await textarea.trigger('toggle-keyboard')

      expect(wrapper.vm.posting).toBe(true)
    })
  })

  describe('Camera Functionality', () => {
    it('calls open_camera when camera button is clicked', async () => {
      const camera_button = wrapper.find('#camera')
      await camera_button.trigger('click')

      expect(mock_open_camera).toHaveBeenCalled()
    })

    it('calls open_camera when camera button keydown enter', async () => {
      const camera_button = wrapper.find('#camera')
      await camera_button.trigger('keydown.enter')

      expect(mock_open_camera).toHaveBeenCalled()
    })
  })

  describe('CSS Classes', () => {
    it('applies correct classes to router links', () => {
      const statements_link = wrapper.find('router-link-stub[to="/statements"]')
      const events_link = wrapper.find('router-link-stub[to="/events"]')
      const posters_link = wrapper.find('router-link-stub[to="/posters"]')
      const phonebook_link = wrapper.find('router-link-stub[to="/phonebook"]')
      const thoughts_link = wrapper.find('router-link-stub[to="/thoughts"]')

      expect(statements_link.classes()).toContain('sediment')
      expect(events_link.classes()).toContain('sediment')
      expect(posters_link.classes()).toContain('green')
      expect(phonebook_link.classes()).toContain('green')
      expect(thoughts_link.classes()).toContain('black')
    })

    it('applies correct class to statement textarea', () => {
      const textarea = wrapper.find('as-textarea-stub')
      expect(textarea.classes()).toContain('red')
    })
  })

  describe('Accessibility', () => {
    it('sets correct tabindex on router links', () => {
      const router_links = wrapper.findAll('router-link-stub')
      router_links.forEach(link => {
        expect(link.attributes('tabindex')).toBe('-1')
      })
    })

    it('sets correct tabindex on camera button', () => {
      const camera_button = wrapper.find('#camera')
      expect(camera_button.attributes('tabindex')).toBe('3')
    })

    it('sets correct tabindex on about link', () => {
      const about_link = wrapper.find('router-link-stub[to="/about"]')
      expect(about_link.attributes('tabindex')).toBe('-1')
    })
  })
})
