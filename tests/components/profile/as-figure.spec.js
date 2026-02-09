import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import { vi } from 'vitest'
import { ref } from 'vue'
import as_figure from '@/components/profile/as-figure'

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    me: '/+16282281824'
  }
})

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useRoute: () => ({
    path: '/test-path'
  })
}))

// Mock the use/people composable
vi.mock('@/use/people', async () => {
  const { ref } = await import('vue')
  return {
    use_me: () => ({
      me: ref(null),
      relations: []
    }),
    is_person: maybe => {
      if (typeof maybe !== 'object') return false
      if (maybe.type !== 'person') return false
      if (!maybe.id) return false
      return true
    }
  }
})

describe('@/component/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    get.mockImplementation(() => Promise.resolve({}))
    person = {
      name: 'Scott Fryxell',
      id: '/+16282281823',
      type: 'person'
    }
    wrapper = shallowMount(as_figure, {
      props: {
        person
      },
      global: {
        stubs: {
          'as-svg': true,
          icon: true,
          'profile-as-meta': true,
          'as-relationship-options': true,
          'as-address': true,
          'as-messenger': true
        }
      }
    })
  })
  describe('Renders', () => {
    it("Render a person's profile info", () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Component Structure', () => {
    it('renders with correct structure', () => {
      expect(wrapper.find('figure.profile').exists()).toBe(true)
      expect(wrapper.find('figcaption').exists()).toBe(true)
    })
  })
})
