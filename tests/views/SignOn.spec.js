import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import SignOn from '@/views/SignOn.vue'

const { mock_replace, mock_hand_off, mock_current_user, mock_me } = vi.hoisted(
  () => {
    const create_ref = value => ({ value, __v_isRef: true })
    return {
      mock_replace: vi.fn(),
      mock_hand_off: vi.fn(),
      mock_current_user: create_ref(null),
      mock_me: create_ref(null)
    }
  }
)
const mock_route = reactive({ query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))
vi.mock('@/utils/serverless', () => ({
  current_user: mock_current_user,
  me: mock_me
}))
vi.mock('@/utils/cli-hand-off', async original => ({
  ...(await original()),
  hand_off: mock_hand_off
}))

const state = 's'.repeat(32)
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
    mock_current_user.value = null
    mock_me.value = null
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

  describe('when a terminal on this computer is waiting', () => {
    beforeEach(() => {
      mock_route.query = { cli: '53124', state }
    })

    it('signs on first, and stays on the page after', () => {
      const wrapper = mount()
      expect(wrapper.find('section#sign-on').exists()).toBe(true)
      wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')
      expect(mock_replace).not.toHaveBeenCalled()
      expect(mock_hand_off).not.toHaveBeenCalled()
    })

    it('sends the sign-in only on a click', async () => {
      mock_current_user.value = { refreshToken: 'r1' }
      mock_me.value = { name: 'Scott Fryxell' }
      const wrapper = mount()
      const button = wrapper.find('button#send-to-terminal')
      expect(button.exists()).toBe(true)
      expect(mock_hand_off).not.toHaveBeenCalled()
      await button.trigger('click')
      expect(mock_hand_off).toHaveBeenCalledWith(
        { port: 53124, state },
        expect.objectContaining({ refresh_token: 'r1' })
      )
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('ignores a malformed request and signs on as usual', () => {
      mock_route.query = { cli: 'evil.example', state }
      mock_current_user.value = { refreshToken: 'r1' }
      mock_me.value = { name: 'Scott Fryxell' }
      const wrapper = mount()
      expect(wrapper.find('button#send-to-terminal').exists()).toBe(false)
    })
  })
})
