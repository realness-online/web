import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsLink from '@/components/account/as-link.vue'

const { mock_me, mock_current_user } = vi.hoisted(() => ({
  mock_me: { value: undefined },
  mock_current_user: { value: undefined }
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user
}))

const mount = () =>
  shallowMount(AsLink, {
    global: {
      stubs: {
        'router-link': {
          props: ['to'],
          template: '<a :href="to"><slot /></a>'
        }
      }
    }
  })

describe('@/components/account/as-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_me.value = undefined
    mock_current_user.value = undefined
    localStorage.clear()
  })

  it('points to /account when signed out (single route owns both states)', () => {
    mock_current_user.value = null
    const wrapper = mount()
    expect(wrapper.find('a').attributes('href')).toBe('/account')
    expect(wrapper.text()).toBe('sign on')
  })

  it('points to /account when signed in with id', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { id: '/+15550000000', name: 'Scott' }
    const wrapper = mount()
    expect(wrapper.find('a').attributes('href')).toBe('/account')
    expect(wrapper.text()).toBe('Scott')
  })

  it('still points to /account when me.id is missing', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = {}
    localStorage.me = '/+15550000000'
    const wrapper = mount()
    expect(wrapper.find('a').attributes('href')).toBe('/account')
  })

  it('shows "account" when signed in but nameless', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { id: '/+15550000000' }
    const wrapper = mount()
    expect(wrapper.text()).toBe('account')
  })

  it('breaks a full name at the first space', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { id: '/+15550000000', name: 'Scott Realness' }
    const wrapper = mount()
    const lines = wrapper.findAll('a span')
    expect(lines).toHaveLength(2)
    expect(lines[0].text()).toBe('Scott')
    expect(lines[1].text()).toBe('Realness')
  })
})
