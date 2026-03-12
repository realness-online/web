import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Navigation from '@/views/Navigation'
import { posting } from '@/use/posting'

vi.mock('@/use/statements', () => ({
  use: () => ({
    save: vi.fn()
  })
}))

vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn()
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ hash: '', path: '/', params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

Object.defineProperty(document, 'querySelector', {
  value: vi.fn(() => ({
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
    style: {},
    value: '',
    selectionStart: 0,
    selectionEnd: 0
  })),
  writable: true
})

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true
})

describe('@/views/Navigation', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    posting.value = false
    wrapper = mount(Navigation, {
      global: {
        stubs: {
          'router-link': true,
          icon: true
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

    it('renders router links for navigation', () => {
      const router_links = wrapper.findAll('router-link-stub')
      expect(router_links.length).toBeGreaterThan(0)

      // Check for specific routes
      const link_to = link => {
        const to = link.attributes('to') ?? link.props('to')
        return typeof to === 'string' ? to : to?.path
      }
      const thoughts_link = router_links.find(l => link_to(l) === '/')
      const events_link = router_links.find(l => link_to(l) === '/events')
      const posters_link = router_links.find(l => link_to(l) === '/posters')
      const phonebook_link = router_links.find(l => link_to(l) === '/phonebook')

      expect(thoughts_link).toBeTruthy()
      expect(events_link).toBeTruthy()
      expect(posters_link).toBeTruthy()
      expect(phonebook_link).toBeTruthy()
    })
  })

  describe('Posting State', () => {
    it('shows posting class when posting is true', async () => {
      posting.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#navigation').classes()).toContain('posting')
    })

    it('hides posting class when posting is false', async () => {
      posting.value = false
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#navigation').classes()).not.toContain('posting')
    })

    it('keeps nav in DOM when posting', async () => {
      posting.value = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('nav').exists()).toBe(true)
      expect(wrapper.findAll('router-link-stub').length).toBeGreaterThan(0)
    })
  })

  describe('CSS Classes', () => {
    it('applies correct classes to router links', () => {
      const link_to = link => {
        const to = link.attributes('to') ?? link.props('to')
        return typeof to === 'string' ? to : to?.path
      }
      const thoughts_link = wrapper
        .findAll('router-link-stub')
        .find(l => link_to(l) === '/')
      const events_link = wrapper
        .findAll('router-link-stub')
        .find(l => link_to(l) === '/events')
      const posters_link = wrapper
        .findAll('router-link-stub')
        .find(l => link_to(l) === '/posters')
      const phonebook_link = wrapper
        .findAll('router-link-stub')
        .find(l => link_to(l) === '/phonebook')

      expect(thoughts_link).toBeTruthy()
      expect(thoughts_link.classes()).toContain('sediment')
      expect(events_link.classes()).toContain('sediment')
      expect(posters_link.classes()).toContain('blue')
      expect(phonebook_link.classes()).toContain('blue')
    })
  })

  describe('Accessibility', () => {
    it('sets correct tabindex on router links', () => {
      const router_links = wrapper.findAll('router-link-stub')
      router_links.forEach(link => {
        expect(link.attributes('tabindex')).toBe('-1')
      })
    })
  })
})
