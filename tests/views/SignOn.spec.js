import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import SignOn from '@/views/SignOn.vue'

const { mock_replace } = vi.hoisted(() => ({ mock_replace: vi.fn() }))
const mock_route = reactive({ query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

const mount = () =>
  shallowMount(SignOn, {
    global: {
      stubs: {
        'as-sign-on': { name: 'AsSignOn', template: '<section id="sign-on" />' }
      }
    }
  })

describe('SignOn page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
  })

  it('shows the sign-on flow on arrival, with nothing to open', () => {
    const wrapper = mount()
    expect(
      wrapper.find('section#signing-on[data-page] section#sign-on').exists()
    ).toBe(true)
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('goes to the account page once signed in', () => {
    mount().findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/account')
  })

  it('goes back to where the visitor was headed', () => {
    mock_route.query = { next: '/discover' }
    mount().findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/discover')
  })
})
