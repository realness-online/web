import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import Thoughts from '@/views/Thoughts.vue'

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
const mock_relations = ref([{ id: '/+14151234356/people/1', type: 'person' }])
vi.mock('@/use/people', () => ({
  use: () => ({
    people: mock_people,
    relations: mock_relations
  }),
  use_me: () => ({
    relations: mock_relations,
    blocked: ref([])
  }),
  get_my_itemid: vi.fn(type => `/+14151234356/${type}`)
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

// Mock thought composable
const mock_thoughts_for_person = vi.fn().mockResolvedValue(undefined)
const mock_thoughts = ref([])
const mock_statement_shown = vi.fn()

vi.mock('@/use/thought', () => ({
  use: () => ({
    thoughts: mock_thoughts,
    statement_shown: mock_statement_shown,
    for_person: mock_thoughts_for_person
  }),
  slot_key: vi.fn(id => id)
}))

// Mock preference utils
vi.mock('@/utils/preference', () => ({
  storytelling: ref(false)
}))

describe('Thoughts', () => {
  let wrapper
  const set_working = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mock_thoughts.value = []
    mock_people.value = []
    mock_relations.value = [{ id: '/+14151234356/people/1', type: 'person' }]

    wrapper = shallowMount(Thoughts, {
      global: {
        provide: { set_working },
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template:
              '<section class="as-days-stub"><slot v-bind="{}" /></section>',
            props: ['working', 'posters', 'thoughts']
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
    it('fills statements with relations on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_thoughts_for_person).toHaveBeenCalled()
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
  })
})
