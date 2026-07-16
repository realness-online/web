import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import SiteNav from '@/components/site-nav.vue'

const { mock_current_user, mock_me } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_current_user: create_ref(null),
    mock_me: create_ref(undefined)
  }
})

vi.mock('@/utils/serverless', () => ({
  current_user: mock_current_user,
  me: mock_me
}))

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const mount = () =>
  shallowMount(SiteNav, {
    global: {
      stubs: {
        'logo-as-link': true,
        'router-link': router_link_stub
      }
    }
  })

describe('@/components/site-nav', () => {
  beforeEach(() => {
    mock_current_user.value = null
    mock_me.value = undefined
  })

  it('renders site links', () => {
    const wrapper = mount()
    const nav = wrapper.find('nav[aria-label="Site"]')
    expect(nav.exists()).toBe(true)
    expect(wrapper.text()).toContain('About')
    expect(wrapper.text()).toContain('Docs')
    expect(wrapper.text()).toContain('Pricing')
    expect(wrapper.text()).toContain('Legal')
  })

  it('labels the account link Sign in when signed out', () => {
    const wrapper = mount()
    expect(wrapper.text()).toContain('Sign in')
  })

  it('labels the account link with the profile name when signed in', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { name: 'Scott' }
    const wrapper = mount()
    expect(wrapper.text()).toContain('Scott')
    expect(wrapper.text()).not.toContain('Sign in')
  })

  it('falls back to Account when signed in without a name', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = {}
    const wrapper = mount()
    expect(wrapper.text()).toContain('Account')
  })
})
