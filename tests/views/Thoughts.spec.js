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
const mock_relations = ref([
  {
    id: '/+14151234356/people/1',
    type: 'person'
  }
])

vi.mock('@/use/people', () => ({
  use: () => ({
    people: mock_people,
    relations: mock_relations
  }),
  use_me: () => ({
    relations: mock_relations
  })
}))

// Mock statement composable
const mock_statements = ref([])
const mock_thought_shown = vi.fn()
const mock_statements_for_person = vi.fn().mockResolvedValue(undefined)

vi.mock('@/use/statement', () => ({
  use: () => ({
    for_person: mock_statements_for_person,
    statements: mock_statements,
    thought_shown: mock_thought_shown
  }),
  slot_key: vi.fn(id => id)
}))

// Mock poster composable
const mock_posters = ref([])
const mock_poster_shown = vi.fn()
const mock_posters_for_person = vi.fn().mockResolvedValue(undefined)

vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    for_person: mock_posters_for_person,
    poster_shown: mock_poster_shown,
    posters: mock_posters
  }),
  is_vector_id: vi.fn().mockReturnValue(true),
  is_url_query: vi.fn().mockReturnValue(true),
  is_rect: vi.fn().mockReturnValue(true),
  is_vector: vi.fn().mockReturnValue(true),
  is_focus: vi.fn().mockReturnValue(true),
  is_click: vi.fn().mockReturnValue(true)
}))

// Mock preference utils
vi.mock('@/utils/preference', () => ({
  storytelling: ref(false)
}))

describe('Thoughts', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mock_people.value = []
    mock_statements.value = []
    mock_posters.value = []
    mock_relations.value = [
      {
        id: '/+14151234356/people/1',
        type: 'person'
      }
    ]

    wrapper = shallowMount(Thoughts, {
      global: {
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template: '<div class="as-days-stub"><slot :items="[]" /></div>',
            props: ['working', 'posters', 'statements']
          },
          'thought-as-article': {
            template: '<div class="article-stub"></div>',
            props: ['statements', 'verbose'],
            emits: ['show']
          },
          'poster-as-figure': {
            template: '<div class="poster-stub"></div>',
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

    it('renders h1 with Thoughts title', () => {
      expect(wrapper.find('h1').text()).toBe('Thoughts')
    })

    it('shows working state initially', () => {
      expect(wrapper.vm.working).toBe(true)
    })
  })

  describe('Functionality', () => {
    it('registers key commands on mount', () => {
      expect(mock_register).toHaveBeenCalledWith('thoughts::Search', expect.any(Function))
      expect(mock_register).toHaveBeenCalledWith('thoughts::NewThought', expect.any(Function))
      expect(mock_register).toHaveBeenCalledWith('thoughts::ClearSearch', expect.any(Function))
    })

    it('fills thoughts with relations on mount', async () => {
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

    it('sets working to false after fill_thoughts completes', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(wrapper.vm.working).toBe(false)
    })

    it('adds storytelling class when storytelling preference is true', async () => {
      const { storytelling } = await import('@/utils/preference')
      storytelling.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('section#thoughts').classes()).toContain('storytelling')
    })
  })
})

