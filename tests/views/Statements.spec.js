import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import Statements from '@/views/Statements.vue'

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
    relations: mock_relations,
    blocked: ref([])
  })
}))

// Mock statement composable
const mock_thoughts = ref([])
const mock_thought_shown = vi.fn()
const mock_statements_for_person = vi.fn().mockResolvedValue(undefined)

vi.mock('@/use/statement', () => ({
  use: () => ({
    for_person: mock_statements_for_person,
    thoughts: mock_thoughts,
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
  is_svg_valid: vi.fn().mockReturnValue(true),
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

describe('Statements', () => {
  let wrapper
  const set_working = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mock_people.value = []
    mock_thoughts.value = []
    mock_posters.value = []
    mock_relations.value = [
      {
        id: '/+14151234356/people/1',
        type: 'person'
      }
    ]

    wrapper = shallowMount(Statements, {
      global: {
        provide: {
          set_working
        },
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template:
              '<section class="as-days-stub"><slot :items="[]" /></section>',
            props: ['working', 'posters', 'thoughts']
          },
          'thought-as-article': {
            template: '<article class="article-stub"></article>',
            props: ['thoughts', 'verbose'],
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
    it('renders statements view', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('section#statements').exists()).toBe(true)
      expect(wrapper.find('section#statements').classes()).toContain('page')
    })

    it('renders header with icon and logo', () => {
      expect(wrapper.find('header').exists()).toBe(true)
    })

    it('renders h1 with Statements title', () => {
      expect(wrapper.find('h1').text()).toBe('Statements')
    })

    it('shows working state initially', () => {
      expect(wrapper.vm.working).toBe(true)
    })
  })

  describe('Functionality', () => {
    it('fills statements with relations on mount', async () => {
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

    it('sets working to false after fill_statements completes', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(wrapper.vm.working).toBe(false)
    })

    it('adds storytelling class when storytelling preference is true', async () => {
      const { storytelling } = await import('@/utils/preference')
      storytelling.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('section#statements').classes()).toContain(
        'storytelling'
      )
    })
  })
})
