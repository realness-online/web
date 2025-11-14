import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import App from '@/App.vue'

// Mock the composables and dependencies
const mock_image_picker = { value: null }
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    vVectorizer: {
      mounted: vi.fn()
    },
    image_picker: mock_image_picker,
    mount_workers: vi.fn()
  })
}))

vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: vi.fn(),
    register_preference: vi.fn()
  })
}))

vi.mock('@/utils/serverless', () => ({
  init_serverless: vi.fn()
}))

vi.mock('@/utils/preference', () => ({
  fill: { value: false },
  stroke: { value: false },
  cutout: { value: false },
  drama: { value: false },
  drama_back: { value: false },
  drama_front: { value: false },
  slice: { value: false },
  bold: { value: false },
  medium: { value: false },
  regular: { value: false },
  light: { value: false },
  background: { value: false },
  boulder: { value: false },
  rock: { value: false },
  gravel: { value: false },
  sand: { value: false },
  sediment: { value: false },
  animate: { value: false },
  info: { value: false },
  storytelling: { value: false },
  animation_speed: { value: 'normal' },
  grid_overlay: { value: false }
}))

describe('App.vue', () => {
  let wrapper

  beforeEach(() => {
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        about: false,
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })

    // Mock matchMedia for standalone detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    wrapper = shallowMount(App, {
      shallow: true,
      global: {
        stubs: {
          sync: { template: '<div></div>', emits: ['active'] }
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders main container with correct id', () => {
      expect(wrapper.find('#realness').exists()).toBe(true)
    })

    it('renders router view', () => {
      expect(wrapper.find('router-view-stub').exists()).toBe(true)
    })

    it('renders sync component', () => {
      expect(wrapper.find('sync-stub').exists()).toBe(true)
    })

    it('renders image picker input', () => {
      const image_picker = wrapper.find('input[type="file"]')
      expect(image_picker.exists()).toBe(true)
      expect(image_picker.attributes('accept')).toBe(
        'image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff,image/avif,image/svg+xml'
      )
      expect(image_picker.classes()).toContain('poster')
      expect(image_picker.classes()).toContain('picker')
    })
  })

  describe('Status Classes', () => {
    it('applies working class when status is working', async () => {
      wrapper.vm.status = 'working'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#realness').classes()).toContain('working')
    })

    it('applies offline class when status is offline', async () => {
      wrapper.vm.status = 'offline'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#realness').classes()).toContain('offline')
    })

    it('has no status class when status is null', async () => {
      wrapper.vm.status = null
      await wrapper.vm.$nextTick()
      const main_element = wrapper.find('#realness')
      expect(main_element.classes()).not.toContain('working')
      expect(main_element.classes()).not.toContain('offline')
    })
  })

  describe('Sync Events', () => {
    it('handles sync active event', async () => {
      wrapper.vm.status = null // Reset status
      wrapper.vm.sync_active(true)
      expect(wrapper.vm.status).toBe('working')
    })

    it('handles sync inactive event', async () => {
      wrapper.vm.status = 'working' // Set initial status
      wrapper.vm.sync_active(false)
      expect(wrapper.vm.status).toBe(null)
    })
  })

  describe('Component References', () => {
    it('has preferences dialog reference', () => {
      expect(wrapper.vm.preferences_dialog).toBeDefined()
    })

    it('has documentation reference', () => {
      expect(wrapper.vm.documentation).toBeDefined()
    })

    it('has image picker reference', () => {
      expect(wrapper.vm.image_picker).toBeDefined()
    })
  })
})
