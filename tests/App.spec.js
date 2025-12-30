import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import App from '@/App.vue'

// Mock the composables and dependencies
const mock_image_picker = ref(null)
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

vi.mock('@/utils/preference', () => {
  const { ref } = require('vue')
  return {
    fill: ref(false),
    stroke: ref(false),
    cutout: ref(false),
    drama: ref(false),
    drama_back: ref(false),
    drama_front: ref(false),
    slice: ref(false),
    bold: ref(false),
    medium: ref(false),
    regular: ref(false),
    light: ref(false),
    background: ref(false),
    boulder: ref(false),
    rock: ref(false),
    gravel: ref(false),
    sand: ref(false),
    sediment: ref(false),
    animate: ref(false),
    info: ref(false),
    storytelling: ref(false),
    animation_speed: ref('normal'),
    grid_overlay: ref(false),
    aspect_ratio_mode: ref('auto'),
    slice_alignment: ref('ymid'),
    show_menu: ref(false)
  }
})

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
      const sync_stub = wrapper.findAll('div').find(div =>
        div.element.parentElement === wrapper.element
      )
      expect(sync_stub).toBeDefined()
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
