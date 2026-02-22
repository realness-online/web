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
vi.mock('@/use/people', () => ({
  get_my_itemid: vi.fn(type => `/+14151234356/${type}`)
}))

// Mock thought composable
const mock_my_thoughts = ref([
  { id: '/+14151234356/thoughts/1', type: 'thoughts' }
])
const mock_thoughts = ref([])
const mock_statement_shown = vi.fn()

vi.mock('@/use/thought', () => ({
  use: () => ({
    my_thoughts: mock_my_thoughts,
    thoughts: mock_thoughts,
    statement_shown: mock_statement_shown
  })
}))

// Mock preference utils
vi.mock('@/utils/preference', () => ({
  storytelling: ref(false)
}))

describe('Statements', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mock_thoughts.value = []
    mock_my_thoughts.value = [
      { id: '/+14151234356/thoughts/1', type: 'thoughts' }
    ]

    wrapper = shallowMount(Statements, {
      global: {
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template:
              '<section class="as-days-stub"><slot v-bind="[]" /></section>',
            props: ['itemid', 'paginate', 'thoughts']
          },
          'thought-as-article': {
            template: '<article class="article-stub"></article>',
            props: ['statements', 'editable'],
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

    it('renders h1 with Statements title', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(wrapper.find('h1').text()).toBe('Statements')
    })

    it('shows working state', () => {
      expect(wrapper.vm.working).toBe(false)
    })
  })

  describe('Functionality', () => {
    it('registers key commands on mount', () => {
      expect(mock_register).toHaveBeenCalledWith(
        'thought::Save',
        expect.any(Function)
      )
      expect(mock_register).toHaveBeenCalledWith(
        'thought::Cancel',
        expect.any(Function)
      )
    })

    it('sets thoughts from my_thoughts on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_thoughts.value.length).toBe(1)
      expect(mock_thoughts.value[0].id).toBe(mock_my_thoughts.value[0].id)
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
      expect(wrapper.find('section#statements').classes()).toContain(
        'storytelling'
      )
    })
  })
})
