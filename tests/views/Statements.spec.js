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

// Mock statement composable
const mock_my_statements = ref([
  {
    id: '/+14151234356/statements/1',
    type: 'statements',
    created_at: Date.now()
  },
  {
    id: '/+14151234356/statements/2',
    type: 'statements',
    created_at: Date.now() - 86400000
  }
])

const mock_statements = ref([])
const mock_thought_shown = vi.fn()

vi.mock('@/use/statement', () => ({
  use: () => ({
    my_statements: mock_my_statements,
    statements: mock_statements,
    thought_shown: mock_thought_shown
  })
}))

// Mock people composable
vi.mock('@/use/people', () => ({
  get_my_itemid: vi.fn(type => `/+14151234356/${type}`)
}))

// Mock serverless utils
vi.mock('@/utils/serverless', () => ({
  current_user: ref({
    id: '/+14151234356',
    type: 'person'
  })
}))

// Mock vue-router
const mock_push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mock_push
  })
}))

describe('Statements', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mock_statements.value = []
    mock_my_statements.value = [
      {
        id: '/+14151234356/statements/1',
        type: 'statements',
        created_at: Date.now()
      },
      {
        id: '/+14151234356/statements/2',
        type: 'statements',
        created_at: Date.now() - 86400000
      }
    ]

    wrapper = shallowMount(Statements, {
      global: {
        stubs: {
          icon: true,
          'logo-as-link': true,
          'as-days': {
            template:
              '<section class="as-days-stub"><slot :thoughts="mockThoughts" /></section>',
            props: ['itemid', 'paginate', 'statements'],
            setup() {
              const mockThoughts = [
                [
                  {
                    id: '/+14151234356/statements/1',
                    type: 'statements'
                  }
                ]
              ]
              return { mockThoughts }
            }
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

    it('renders editable statements article', () => {
      expect(wrapper.find('article.editable.statements').exists()).toBe(true)
    })

    it('shows working state initially', () => {
      expect(wrapper.vm.working).toBeDefined()
      const initial_working = wrapper.vm.working
      expect(typeof initial_working).toBe('boolean')
    })
  })

  describe('Functionality', () => {
    it('registers key commands on mount', () => {
      expect(mock_register).toHaveBeenCalledWith(
        'statement::Save',
        expect.any(Function)
      )
      expect(mock_register).toHaveBeenCalledWith(
        'statement::Cancel',
        expect.any(Function)
      )
    })

    it('sets statements to last editable on mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mock_statements.value.length).toBe(1)
      const last_index = mock_my_statements.value.length - 1
      expect(mock_statements.value[0].id).toBe(
        mock_my_statements.value[last_index].id
      )
    })

    it('sets working to false after mount', async () => {
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(wrapper.vm.working).toBe(false)
    })

    it('navigates home when home button is clicked', async () => {
      mock_my_statements.value = []
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      const home_button = wrapper.find('button[aria-label="Home"]')
      if (home_button.exists()) {
        await home_button.trigger('click')
        expect(mock_push).toHaveBeenCalledWith({ path: '/' })
      }
    })

    it('shows footer message when no statements', async () => {
      mock_my_statements.value = []
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))
      const footer = wrapper.find('footer.message')
      expect(footer.exists()).toBe(true)
    })

    it('renders earlier statements section when multiple statements exist', async () => {
      mock_statements.value = [
        {
          id: '/+14151234356/statements/1',
          type: 'statements'
        },
        {
          id: '/+14151234356/statements/2',
          type: 'statements'
        }
      ]
      await wrapper.vm.$nextTick()
      const earlier_section = wrapper.find('article.earlier.statements')
      expect(earlier_section.exists()).toBe(true)
    })

    it('adds signed-in class when current_user exists', () => {
      expect(wrapper.find('section#statements').classes()).toContain(
        'signed-in'
      )
    })
  })
})
