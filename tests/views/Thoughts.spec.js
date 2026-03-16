import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import Thoughts from '@/views/Thoughts.vue'

const { mock_current_user_ref } = vi.hoisted(() => {
  const mock_current_user_ref = { value: { uid: 'test-user' } }
  return { mock_current_user_ref }
})

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return mock_current_user_ref
  },
  directory: vi.fn().mockResolvedValue({ items: [], prefixes: [] }),
  url: vi.fn().mockResolvedValue(null),
  me: { value: undefined }
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  },
  writable: true
})

// Mock console methods
vi.spyOn(console, 'time').mockImplementation(() => {})
vi.spyOn(console, 'timeEnd').mockImplementation(() => {})

// Mock key-commands composable
const mock_register = vi.fn()
vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: mock_register
  })
}))

// Mock people composable
const mock_people = ref([])
const mock_phonebook = ref([{ id: '/+14151234356/people/1', type: 'person' }])
const mock_load_phonebook = vi.fn().mockResolvedValue(undefined)
vi.mock('@/use/people', () => ({
  use: () => ({
    people: mock_people,
    phonebook: mock_phonebook,
    load_phonebook: mock_load_phonebook
  }),
  get_my_itemid: vi.fn(type => `/+14151234356/${type}`),
  is_person: maybe => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))

// Mock poster composable
const mock_posters = ref([])
const mock_posters_for_person = vi.fn().mockResolvedValue(undefined)
vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    for_person: mock_posters_for_person,
    poster_shown: vi.fn(),
    posters: mock_posters
  }),
  slot_key: vi.fn(id => id),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_svg_valid: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

// Mock statements composable
const mock_statements_for_person = vi.fn().mockResolvedValue(undefined)
const mock_statements = ref([])
const mock_statement_shown = vi.fn()

vi.mock('@/use/statements', () => ({
  use: () => ({
    statements: mock_statements,
    my_statements: mock_statements,
    statement_shown: mock_statement_shown,
    for_person: mock_statements_for_person,
    update_statement: vi.fn()
  }),
  slot_key: vi.fn(id => id)
}))

vi.mock('@/utils/preference', () => ({
  storytelling: ref(false),
  aspect_ratio_mode: ref('auto'),
  menu: ref(true)
}))

describe('Thoughts', () => {
  let wrapper
  const set_working = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mock_current_user_ref.value = { uid: 'test-user' }
    mock_statements.value = []
    mock_people.value = []
    mock_phonebook.value = [{ id: '/+14151234356/people/1', type: 'person' }]

    wrapper = shallowMount(Thoughts, {
      global: {
        provide: {
          set_working,
          select_photo: vi.fn(),
          register_account: vi.fn(),
          init_processing_queue: vi.fn(),
          queue_items: ref([])
        },
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template:
              '<section class="as-days-stub"><slot v-bind="{}" /></section>',
            props: ['working', 'posters', 'statements']
          },
          'thought-as-article': {
            template: '<article class="article-stub"></article>',
            props: ['statements', 'verbose'],
            emits: ['show']
          },
          'poster-as-figure': {
            template: '<figure class="poster-stub"></figure>',
            props: ['itemid'],
            emits: ['show']
          }
        }
      }
    })
  })

  describe('Rendering', () => {
    it('renders thoughts view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#thoughts').exists()).toBe(true)
      expect(wrapper.find('section#thoughts').classes()).toContain('page')
    })

    it('renders header with icon and logo', () => {
      expect(wrapper.find('header').exists()).toBe(true)
    })

    it('renders h1 with Thoughts title', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      const h1 = wrapper.find('h1')
      expect(h1.exists()).toBe(true)
      expect(h1.text()).toBe('Thoughts')
    })

    it('has working state', () => {
      expect(wrapper.vm.working).toBeDefined()
      expect(typeof wrapper.vm.working).toBe('boolean')
    })
  })

  describe('Functionality', () => {
    it('fills statements with phonebook on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_statements_for_person).toHaveBeenCalled()
      expect(mock_posters_for_person).toHaveBeenCalled()
    })

    it('adds current user to people list', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_people.value.some(p => p.id === '/+14151234356')).toBe(true)
    })

    it('sets working to false after mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(wrapper.vm.working).toBe(false)
    })

    it('adds storytelling class when storytelling preference is true', async () => {
      const { storytelling } = await import('@/utils/preference')
      storytelling.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('section#thoughts').classes()).toContain(
        'storytelling'
      )
    })

    it('adds admin to people and fetches admin thoughts when not signed in', async () => {
      vi.stubEnv('VITE_ADMIN_ID', '+14151234356')
      mock_current_user_ref.value = null
      mock_phonebook.value = []
      const original_me = window.localStorage.me
      Object.defineProperty(window.localStorage, 'me', {
        value: undefined,
        writable: true
      })

      const local_wrapper = shallowMount(Thoughts, {
        global: {
          provide: {
            set_working: vi.fn(),
            select_photo: vi.fn(),
            register_account: vi.fn(),
            init_processing_queue: vi.fn(),
            queue_items: ref([])
          },
          stubs: {
            icon: true,
            'logo-as-link': true,
            'as-days': {
              template:
                '<section class="as-days-stub"><slot v-bind="{}" /></section>',
              props: ['working', 'posters', 'statements']
            },
            'thought-as-article': {
              template: '<article class="article-stub"></article>',
              props: ['statements', 'verbose'],
              emits: ['show']
            },
            'poster-as-figure': {
              template: '<figure class="poster-stub"></figure>',
              props: ['itemid'],
              emits: ['show']
            }
          }
        }
      })

      await local_wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mock_statements_for_person).toHaveBeenCalledWith({
        id: '/+14151234356'
      })
      expect(mock_people.value.some(p => p.id === '/+14151234356')).toBe(true)

      vi.unstubAllEnvs()
      mock_current_user_ref.value = { uid: 'test-user' }
      mock_phonebook.value = [{ id: '/+14151234356/people/1', type: 'person' }]
      Object.defineProperty(window.localStorage, 'me', {
        value: original_me,
        writable: true
      })
    })
  })
})
