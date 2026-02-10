import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import App from '@/App.vue'

// Mock variables must be hoisted using vi.hoisted() to work with vi.mock
// Create simple objects with .value property (compatible with Vue refs)
const {
  mock_image_picker,
  mock_register,
  mock_register_preference,
  mock_fill,
  mock_stroke,
  mock_cutout,
  mock_drama,
  mock_drama_back,
  mock_drama_front,
  mock_slice,
  mock_bold,
  mock_medium,
  mock_regular,
  mock_light,
  mock_background,
  mock_boulders,
  mock_rocks,
  mock_gravel,
  mock_sand,
  mock_sediment,
  mock_animate,
  mock_info,
  mock_storytelling,
  mock_grid_overlay,
  mock_menu,
  mock_aspect_ratio_mode,
  mock_slice_alignment
} = vi.hoisted(() => {
  const create_ref = value => ({ value })
  const create_template_ref = value =>
    Object.assign(create_ref(value), { __v_isRef: true })
  return {
    mock_image_picker: create_template_ref(null),
    mock_register: vi.fn(),
    mock_register_preference: vi.fn(),
    mock_fill: create_ref(false),
    mock_stroke: create_ref(false),
    mock_cutout: create_ref(false),
    mock_drama: create_ref(false),
    mock_drama_back: create_ref(false),
    mock_drama_front: create_ref(false),
    mock_slice: create_ref(false),
    mock_bold: create_ref(false),
    mock_medium: create_ref(false),
    mock_regular: create_ref(false),
    mock_light: create_ref(false),
    mock_background: create_ref(false),
    mock_boulders: create_ref(false),
    mock_rocks: create_ref(false),
    mock_gravel: create_ref(false),
    mock_sand: create_ref(false),
    mock_sediment: create_ref(false),
    mock_animate: create_ref(false),
    mock_info: create_ref(false),
    mock_storytelling: create_ref(false),
    mock_grid_overlay: create_ref(false),
    mock_menu: create_ref(false),
    mock_aspect_ratio_mode: create_ref('auto'),
    mock_slice_alignment: create_ref('ymid')
  }
})

vi.mock('@/use/vectorize', () => ({
  use: () => ({
    vVectorizer: {
      mounted: vi.fn()
    },
    image_picker: mock_image_picker,
    new_vector: { value: null },
    current_processing: { value: null },
    open_camera: vi.fn(),
    select_photo: vi.fn(),
    can_add: { value: true },
    init_processing_queue: vi.fn(),
    queue_items: { value: [] },
    mount_workers: vi.fn()
  })
}))

vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: mock_register,
    register_preference: mock_register_preference
  })
}))

vi.mock('@/utils/serverless', () => ({
  init_serverless: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useFps: vi.fn(() => ({ value: 60 })),
  useMagicKeys: vi.fn(() => ({
    shift: { value: false }
  }))
}))

const mock_router_push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mock_router_push
  })
}))

vi.mock('@/utils/preference', async () => {
  const { ref } = await import('vue')
  // Create real Vue refs for reactivity (watchers need real refs)
  const fill_ref = ref(false)
  const stroke_ref = ref(false)
  const cutout_ref = ref(false)
  const drama_ref = ref(false)
  const drama_back_ref = ref(false)
  const drama_front_ref = ref(false)
  const slice_ref = ref(false)
  const bold_ref = ref(false)
  const medium_ref = ref(false)
  const regular_ref = ref(false)
  const light_ref = ref(false)
  const background_ref = ref(false)
  const boulders_ref = ref(false)
  const rocks_ref = ref(false)
  const gravel_ref = ref(false)
  const sand_ref = ref(false)
  const sediment_ref = ref(false)
  const animate_ref = ref(false)
  const info_ref = ref(false)
  const storytelling_ref = ref(false)
  const grid_overlay_ref = ref(false)
  const menu_ref = ref(false)
  const aspect_ratio_mode_ref = ref('auto')
  const slice_alignment_ref = ref('ymid')

  // Sync hoisted objects to proxy the refs
  Object.defineProperty(mock_fill, 'value', {
    get: () => fill_ref.value,
    set: v => {
      fill_ref.value = v
    }
  })
  Object.defineProperty(mock_stroke, 'value', {
    get: () => stroke_ref.value,
    set: v => {
      stroke_ref.value = v
    }
  })
  Object.defineProperty(mock_cutout, 'value', {
    get: () => cutout_ref.value,
    set: v => {
      cutout_ref.value = v
    }
  })
  Object.defineProperty(mock_drama, 'value', {
    get: () => drama_ref.value,
    set: v => {
      drama_ref.value = v
    }
  })
  Object.defineProperty(mock_drama_back, 'value', {
    get: () => drama_back_ref.value,
    set: v => {
      drama_back_ref.value = v
    }
  })
  Object.defineProperty(mock_drama_front, 'value', {
    get: () => drama_front_ref.value,
    set: v => {
      drama_front_ref.value = v
    }
  })
  Object.defineProperty(mock_slice, 'value', {
    get: () => slice_ref.value,
    set: v => {
      slice_ref.value = v
    }
  })
  Object.defineProperty(mock_bold, 'value', {
    get: () => bold_ref.value,
    set: v => {
      bold_ref.value = v
    }
  })
  Object.defineProperty(mock_medium, 'value', {
    get: () => medium_ref.value,
    set: v => {
      medium_ref.value = v
    }
  })
  Object.defineProperty(mock_regular, 'value', {
    get: () => regular_ref.value,
    set: v => {
      regular_ref.value = v
    }
  })
  Object.defineProperty(mock_light, 'value', {
    get: () => light_ref.value,
    set: v => {
      light_ref.value = v
    }
  })
  Object.defineProperty(mock_background, 'value', {
    get: () => background_ref.value,
    set: v => {
      background_ref.value = v
    }
  })
  Object.defineProperty(mock_boulders, 'value', {
    get: () => boulders_ref.value,
    set: v => {
      boulders_ref.value = v
    }
  })
  Object.defineProperty(mock_rocks, 'value', {
    get: () => rocks_ref.value,
    set: v => {
      rocks_ref.value = v
    }
  })
  Object.defineProperty(mock_gravel, 'value', {
    get: () => gravel_ref.value,
    set: v => {
      gravel_ref.value = v
    }
  })
  Object.defineProperty(mock_sand, 'value', {
    get: () => sand_ref.value,
    set: v => {
      sand_ref.value = v
    }
  })
  Object.defineProperty(mock_sediment, 'value', {
    get: () => sediment_ref.value,
    set: v => {
      sediment_ref.value = v
    }
  })
  Object.defineProperty(mock_animate, 'value', {
    get: () => animate_ref.value,
    set: v => {
      animate_ref.value = v
    }
  })
  Object.defineProperty(mock_info, 'value', {
    get: () => info_ref.value,
    set: v => {
      info_ref.value = v
    }
  })
  Object.defineProperty(mock_storytelling, 'value', {
    get: () => storytelling_ref.value,
    set: v => {
      storytelling_ref.value = v
    }
  })
  Object.defineProperty(mock_grid_overlay, 'value', {
    get: () => grid_overlay_ref.value,
    set: v => {
      grid_overlay_ref.value = v
    }
  })
  Object.defineProperty(mock_menu, 'value', {
    get: () => menu_ref.value,
    set: v => {
      menu_ref.value = v
    }
  })
  Object.defineProperty(mock_aspect_ratio_mode, 'value', {
    get: () => aspect_ratio_mode_ref.value,
    set: v => {
      aspect_ratio_mode_ref.value = v
    }
  })
  Object.defineProperty(mock_slice_alignment, 'value', {
    get: () => slice_alignment_ref.value,
    set: v => {
      slice_alignment_ref.value = v
    }
  })

  return {
    fill: fill_ref,
    stroke: stroke_ref,
    cutout: cutout_ref,
    drama: drama_ref,
    drama_back: drama_back_ref,
    drama_front: drama_front_ref,
    slice: slice_ref,
    bold: bold_ref,
    medium: medium_ref,
    regular: regular_ref,
    light: light_ref,
    background: background_ref,
    boulders: boulders_ref,
    rocks: rocks_ref,
    gravel: gravel_ref,
    sand: sand_ref,
    sediment: sediment_ref,
    animate: animate_ref,
    info: info_ref,
    storytelling: storytelling_ref,
    animation_speed: ref('normal'),
    grid_overlay: grid_overlay_ref,
    menu: menu_ref,
    aspect_ratio_mode: aspect_ratio_mode_ref,
    slice_alignment: slice_alignment_ref
  }
})

describe('App.vue', () => {
  let wrapper
  let registered_handlers = {}
  let registered_preferences = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mock_router_push.mockClear()
    registered_handlers = {}
    registered_preferences = {}

    mock_register.mockImplementation((command, handler) => {
      registered_handlers[command] = handler
    })
    mock_register_preference.mockImplementation((command, preference_ref) => {
      registered_preferences[command] = preference_ref
    })

    // Reset preference refs
    mock_fill.value = false
    mock_stroke.value = false
    mock_cutout.value = false
    mock_drama.value = false
    mock_drama_back.value = false
    mock_drama_front.value = false
    mock_bold.value = false
    mock_medium.value = false
    mock_regular.value = false
    mock_light.value = false
    mock_background.value = false
    mock_boulders.value = false
    mock_rocks.value = false
    mock_gravel.value = false
    mock_sand.value = false
    mock_sediment.value = false
    mock_aspect_ratio_mode.value = 'auto'
    mock_slice_alignment.value = 'ymid'

    // Mock sessionStorage
    const sessionStorage_storage = {
      about: false,
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorage_storage,
      writable: true
    })
    // Make sessionStorage properties writable
    Object.defineProperty(sessionStorage_storage, 'about', {
      value: false,
      writable: true,
      configurable: true
    })

    // Mock localStorage
    const localStorage_storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      sync_time: 'test'
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorage_storage,
      writable: true
    })
    // Make localStorage properties deletable
    Object.defineProperty(localStorage_storage, 'sync_time', {
      value: 'test',
      writable: true,
      configurable: true
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

    // Mock document methods
    document.documentElement.style.setProperty = vi.fn()
    document.documentElement.requestFullscreen = vi.fn()
    document.exitFullscreen = vi.fn()
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true
    })

    // Mock window.navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        standalone: false
      },
      writable: true,
      configurable: true
    })

    Object.defineProperty(document, 'referrer', {
      value: '',
      writable: true,
      configurable: true
    })

    wrapper = shallowMount(App, {
      shallow: true,
      global: {
        stubs: {
          sync: { template: '<aside></aside>', emits: ['active'] },
          'router-view': true,
          'dialog-preferences': true,
          'dialog-documentation': true,
          'fps-component': true
        },
        mocks: {
          $router: {
            push: vi.fn()
          }
        }
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('Rendering', () => {
    it('renders main container with correct id', () => {
      expect(wrapper.find('#realness').exists()).toBe(true)
    })

    it('renders router view', () => {
      expect(wrapper.find('router-view-stub').exists()).toBe(true)
    })

    it('renders sync component', () => {
      const sync_stub = wrapper
        .findAll('aside')
        .find(aside => aside.element.parentElement === wrapper.element)
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

  describe('set_working', () => {
    it('sets status to working when active is true', () => {
      wrapper.vm.set_working(true)
      expect(wrapper.vm.status).toBe('working')
    })

    it('sets status to null when active is false', () => {
      wrapper.vm.status = 'working'
      wrapper.vm.set_working(false)
      expect(wrapper.vm.status).toBe(null)
    })
  })

  describe('Preference Handlers', () => {
    describe('Toggle_Fill', () => {
      it('toggles fill preference', () => {
        const handler = registered_handlers['pref::Toggle_Fill']
        expect(handler).toBeDefined()
        handler()
        expect(mock_fill.value).toBe(true)
      })

      it('enables all shadow layers when fill is turned on', () => {
        const handler = registered_handlers['pref::Toggle_Fill']
        handler()
        expect(mock_bold.value).toBe(true)
        expect(mock_medium.value).toBe(true)
        expect(mock_regular.value).toBe(true)
        expect(mock_light.value).toBe(true)
        expect(mock_background.value).toBe(true)
      })
    })

    describe('Toggle_Cutout', () => {
      it('toggles cutout preference', () => {
        const handler = registered_handlers['pref::Toggle_Cutout']
        expect(handler).toBeDefined()
        handler()
        expect(mock_cutout.value).toBe(true)
      })

      it('enables all geology layers when cutout is turned on', () => {
        const handler = registered_handlers['pref::Toggle_Cutout']
        handler()
        expect(mock_boulders.value).toBe(true)
        expect(mock_rocks.value).toBe(true)
        expect(mock_gravel.value).toBe(true)
        expect(mock_sand.value).toBe(true)
        expect(mock_sediment.value).toBe(true)
      })
    })

    describe('Toggle_Drama', () => {
      it('toggles drama and syncs drama_back and drama_front', () => {
        const handler = registered_handlers['pref::Toggle_Drama']
        expect(handler).toBeDefined()
        handler()
        expect(mock_drama.value).toBe(true)
        expect(mock_drama_back.value).toBe(true)
        expect(mock_drama_front.value).toBe(true)
      })
    })

    describe('Cycle_Drama', () => {
      it('cycles through drama states: back only', () => {
        const handler = registered_handlers['pref::Cycle_Drama']
        expect(handler).toBeDefined()
        handler()
        expect(mock_drama_back.value).toBe(true)
        expect(mock_drama_front.value).toBe(false)
        expect(mock_drama.value).toBe(true)
      })

      it('cycles through drama states: front only', () => {
        const handler = registered_handlers['pref::Cycle_Drama']
        mock_drama_back.value = true
        mock_drama_front.value = false
        handler()
        expect(mock_drama_back.value).toBe(false)
        expect(mock_drama_front.value).toBe(true)
        expect(mock_drama.value).toBe(true)
      })

      it('cycles through drama states: both', () => {
        const handler = registered_handlers['pref::Cycle_Drama']
        mock_drama_back.value = false
        mock_drama_front.value = true
        handler()
        expect(mock_drama_back.value).toBe(true)
        expect(mock_drama_front.value).toBe(true)
        expect(mock_drama.value).toBe(true)
      })

      it('cycles through drama states: off', () => {
        const handler = registered_handlers['pref::Cycle_Drama']
        mock_drama_back.value = true
        mock_drama_front.value = true
        handler()
        expect(mock_drama_back.value).toBe(false)
        expect(mock_drama_front.value).toBe(false)
        expect(mock_drama.value).toBe(false)
      })
    })

    describe('Cycle_Aspect_Ratio', () => {
      it('cycles to next aspect ratio', () => {
        const handler = registered_handlers['pref::Cycle_Aspect_Ratio']
        expect(handler).toBeDefined()
        handler()
        expect(mock_aspect_ratio_mode.value).toBe('1/1')
        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
          '--poster-aspect-ratio',
          '1/1'
        )
      })

      it('cycles through aspect ratios correctly', () => {
        const handler = registered_handlers['pref::Cycle_Aspect_Ratio']
        mock_aspect_ratio_mode.value = 'auto'
        handler()
        expect(mock_aspect_ratio_mode.value).toBe('1/1')

        mock_aspect_ratio_mode.value = '2.76/1'
        handler()
        expect(mock_aspect_ratio_mode.value).toBe('auto')
      })
    })

    describe('Slice_Alignment_Up', () => {
      it('cycles slice alignment up', () => {
        const handler = registered_handlers['pref::Slice_Alignment_Up']
        expect(handler).toBeDefined()
        handler()
        expect(mock_slice_alignment.value).toBe('ymin')
      })

      it('cycles from ymax to ymid', () => {
        const handler = registered_handlers['pref::Slice_Alignment_Up']
        mock_slice_alignment.value = 'ymax'
        handler()
        expect(mock_slice_alignment.value).toBe('ymid')
      })
    })

    describe('Slice_Alignment_Down', () => {
      it('cycles slice alignment down', () => {
        const handler = registered_handlers['pref::Slice_Alignment_Down']
        expect(handler).toBeDefined()
        handler()
        expect(mock_slice_alignment.value).toBe('ymax')
      })

      it('cycles from ymin to ymid', () => {
        const handler = registered_handlers['pref::Slice_Alignment_Down']
        mock_slice_alignment.value = 'ymin'
        handler()
        expect(mock_slice_alignment.value).toBe('ymid')
      })
    })
  })

  describe('Watch aspect_ratio_mode', () => {
    it('updates CSS variable when aspect_ratio_mode changes', async () => {
      vi.clearAllMocks()
      mock_aspect_ratio_mode.value = '16/9'
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--poster-aspect-ratio',
        '16/9'
      )
    })

    it('sets to auto when aspect_ratio_mode is auto', async () => {
      mock_aspect_ratio_mode.value = 'auto'
      await wrapper.vm.$nextTick()
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--poster-aspect-ratio',
        'auto'
      )
    })
  })

  describe('UI Handlers', () => {
    it('shows documentation dialog', () => {
      const handler = registered_handlers['ui::Show_Documentation']
      expect(handler).toBeDefined()
      wrapper.vm.documentation = { show: vi.fn() }
      handler()
      expect(wrapper.vm.documentation.show).toHaveBeenCalled()
    })

    it('shows preferences dialog', () => {
      const handler = registered_handlers['ui::Open_Settings']
      expect(handler).toBeDefined()
      wrapper.vm.preferences_dialog = { show: vi.fn() }
      handler()
      expect(wrapper.vm.preferences_dialog.show).toHaveBeenCalled()
    })

    it('shows account dialog', () => {
      const handler = registered_handlers['ui::Open_Account']
      expect(handler).toBeDefined()
      wrapper.vm.account_dialog = { show: vi.fn() }
      handler()
      expect(wrapper.vm.account_dialog.show).toHaveBeenCalled()
    })

    it('clears sync time from localStorage', () => {
      const handler = registered_handlers['ui::Clear_Sync_Time']
      expect(handler).toBeDefined()
      expect(window.localStorage.sync_time).toBe('test')
      handler()
      expect(window.localStorage.sync_time).toBeUndefined()
    })

    it('toggles presentation mode - enters fullscreen', () => {
      const handler = registered_handlers['ui::Toggle_Presentation']
      expect(handler).toBeDefined()
      document.fullscreenElement = null
      handler()
      expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
    })

    it('toggles presentation mode - exits fullscreen', () => {
      const handler = registered_handlers['ui::Toggle_Presentation']
      document.fullscreenElement = document.documentElement
      handler()
      expect(document.exitFullscreen).toHaveBeenCalled()
    })
  })

  describe('Navigation Handlers', () => {
    it('navigates to home', () => {
      const handler = registered_handlers['nav::Go_Home']
      expect(handler).toBeDefined()
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/')
    })

    it('navigates to statements', () => {
      const handler = registered_handlers['nav::Go_Statements']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/statements')
    })

    it('navigates to events', () => {
      const handler = registered_handlers['nav::Go_Events']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/events')
    })

    it('navigates to posters', () => {
      const handler = registered_handlers['nav::Go_Posters']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/posters')
    })

    it('navigates to phonebook', () => {
      const handler = registered_handlers['nav::Go_Phonebook']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/phonebook')
    })

    it('navigates to thoughts', () => {
      const handler = registered_handlers['nav::Go_Thoughts']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/thoughts')
    })

    it('navigates to about', () => {
      const handler = registered_handlers['nav::Go_About']
      handler()
      expect(mock_router_push).toHaveBeenCalledWith('/about')
    })
  })

  describe('Online/Offline Handlers', () => {
    it('sets contenteditable to true on online', () => {
      const editable = document.createElement('div')
      editable.setAttribute('contenteditable', 'false')
      document.body.appendChild(editable)
      wrapper.vm.online()
      expect(editable.getAttribute('contenteditable')).toBe('true')
      document.body.removeChild(editable)
    })

    it('sets status to null on online', () => {
      wrapper.vm.status = 'offline'
      wrapper.vm.online()
      expect(wrapper.vm.status).toBe(null)
    })

    it('sets contenteditable to false on offline', () => {
      const editable = document.createElement('div')
      editable.setAttribute('contenteditable', 'true')
      document.body.appendChild(editable)
      wrapper.vm.offline()
      expect(editable.getAttribute('contenteditable')).toBe('false')
      document.body.removeChild(editable)
    })

    it('sets status to offline on offline', () => {
      wrapper.vm.status = null
      wrapper.vm.offline()
      expect(wrapper.vm.status).toBe('offline')
    })
  })

  describe('Mounted Hook', () => {
    it('initializes drama preferences if not set', async () => {
      window.localStorage.getItem.mockImplementation(key => {
        if (key === 'drama_back' || key === 'drama_front') return null
        return null
      })
      mock_drama.value = true
      const new_wrapper = shallowMount(App, {
        shallow: true,
        global: {
          stubs: {
            sync: { template: '<aside></aside>', emits: ['active'] },
            'router-view': true,
            'dialog-preferences': true,
            'dialog-documentation': true,
            'fps-component': true
          },
          mocks: {
            $router: {
              push: vi.fn()
            }
          }
        }
      })
      await new_wrapper.vm.$nextTick()
      expect(mock_drama_back.value).toBe(true)
      expect(mock_drama_front.value).toBe(true)
      new_wrapper.unmount()
    })

    it('sets aspect ratio CSS variable on mount', async () => {
      mock_aspect_ratio_mode.value = '16/9'
      const new_wrapper = shallowMount(App, {
        shallow: true,
        global: {
          stubs: {
            sync: { template: '<aside></aside>', emits: ['active'] },
            'router-view': true,
            'dialog-preferences': true,
            'dialog-documentation': true,
            'fps-component': true
          },
          mocks: {
            $router: {
              push: vi.fn()
            }
          }
        }
      })
      await new_wrapper.vm.$nextTick()
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--poster-aspect-ratio',
        '16/9'
      )
      new_wrapper.unmount()
    })

    it('detects standalone mode and sets sessionStorage', async () => {
      window.matchMedia.mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
      const new_wrapper = shallowMount(App, {
        shallow: true,
        global: {
          stubs: {
            sync: { template: '<aside></aside>', emits: ['active'] },
            'router-view': true,
            'dialog-preferences': true,
            'dialog-documentation': true,
            'fps-component': true
          },
          mocks: {
            $router: {
              push: vi.fn()
            }
          }
        }
      })
      await new_wrapper.vm.$nextTick()
      expect(window.sessionStorage.about).toBe(true)
      new_wrapper.unmount()
    })

    it('adds online and offline event listeners', async () => {
      const add_listener_spy = vi.spyOn(window, 'addEventListener')
      const new_wrapper = shallowMount(App, {
        shallow: true,
        global: {
          stubs: {
            sync: { template: '<aside></aside>', emits: ['active'] },
            'router-view': true,
            'dialog-preferences': true,
            'dialog-documentation': true,
            'fps-component': true
          },
          mocks: {
            $router: {
              push: vi.fn()
            }
          }
        }
      })
      await new_wrapper.vm.$nextTick()
      expect(add_listener_spy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(add_listener_spy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
      new_wrapper.unmount()
    })
  })

  describe('Dismount Hook', () => {
    it('removes online and offline event listeners', () => {
      const remove_listener_spy = vi.spyOn(window, 'removeEventListener')
      wrapper.unmount()
      expect(remove_listener_spy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(remove_listener_spy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })
  })
})
