import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import Editor from '@/views/Editor'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: '123' }
  }),
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn()
  })
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+14151234356'
  }
})

// Mock vectorize composable
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    new_vector: ref(null),
    new_gradients: ref(null),
    new_cutouts: ref(null),
    progress: ref(0)
  })
}))

describe('@/views/Editor', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = shallowMount(Editor, {
      global: {
        stubs: {
          icon: true,
          'as-svg': true
        }
      }
    })
  })

  it('renders editor component', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('renders with correct structure', () => {
    expect(wrapper.find('section#editor').exists()).toBe(true)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('figure').exists()).toBe(true)
  })
})
