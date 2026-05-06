import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import SignOn from '@/views/SignOn.vue'

const { mock_replace, mock_route, mock_me, mock_current_user } = vi.hoisted(
  () => ({
    mock_replace: vi.fn(),
    mock_route: { query: {} },
    mock_me: { value: undefined, __v_isRef: true },
    mock_current_user: { value: null, __v_isRef: true }
  })
)

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user
}))

describe('SignOn', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    mock_route.query = {}
    mock_me.value = undefined
    localStorage.clear()
    wrapper = shallowMount(SignOn, {
      global: {
        stubs: {
          'logo-as-link': true,
          icon: true,
          'as-sign-on': true
        }
      }
    })
  })

  it('renders the sign-on page section', () => {
    expect(wrapper.find('section#sign-on-page.page').exists()).toBe(true)
  })

  it('routes to ?next path when sign-on emits signed_in', async () => {
    mock_route.query = { next: '/account' }
    await wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/account')
  })

  it('falls back to me.id when ?next is missing', async () => {
    mock_me.value = { id: '/+15550000000' }
    await wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/+15550000000')
  })

  it('falls back to / when nothing is known', async () => {
    await wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/')
  })

  it('ignores ?next that is not a path', async () => {
    mock_route.query = { next: 'https://evil.example' }
    mock_me.value = { id: '/+15550000000' }
    await wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
    expect(mock_replace).toHaveBeenCalledWith('/+15550000000')
  })
})
