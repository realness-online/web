import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import SiteNav from '@/components/site-nav.vue'

const { mock_current_user, mock_me, mock_route } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_route: { path: '/' },
    mock_current_user: create_ref(null),
    mock_me: create_ref(undefined)
  }
})

vi.mock('@/utils/serverless', () => ({
  current_user: mock_current_user,
  me: mock_me
}))

vi.mock('vue-router', () => ({ useRoute: () => mock_route }))

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
    mock_route.path = '/'
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
    expect(wrapper.text()).not.toContain('License')
    expect(wrapper.text()).not.toContain('Legal')
  })

  it('marks Pricing current on each tier, but not on another page', () => {
    for (const path of [
      '/pricing/endorse',
      '/pricing/support',
      '/pricing/sustain'
    ]) {
      mock_route.path = path
      const wrapper = mount()
      expect(wrapper.get('a[href="/pricing"]').attributes('aria-current')).toBe(
        'page'
      )
      wrapper.unmount()
    }
    mock_route.path = '/about'
    const wrapper = mount()
    expect(
      wrapper.get('a[href="/pricing"]').attributes('aria-current')
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('types the nav with an absolute itemtype, as microdata requires', () => {
    const nav = mount().find('nav[aria-label="Site"]')
    expect(nav.attributes('itemtype')).toBe(
      'https://schema.org/SiteNavigationElement'
    )
  })

  it('labels the account link Account when signed out', () => {
    const wrapper = mount()
    expect(wrapper.get('a[href="/account"]').attributes('aria-label')).toBe(
      'Account'
    )
    expect(wrapper.text()).not.toContain('Sign in')
  })

  it('labels the account link with the profile name when signed in', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { name: 'Scott' }
    const wrapper = mount()
    expect(wrapper.get('a[href="/account"]').attributes('aria-label')).toBe(
      'Scott'
    )
    expect(wrapper.text()).not.toContain('Sign in')
  })

  it('opens account settings when signed out', () => {
    const wrapper = mount()
    const account = wrapper.findAllComponents(router_link_stub).at(-1)
    expect(account.props('to')).toBe('/account')
  })

  it('goes to the account page once signed in', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = { name: 'Scott' }
    const wrapper = mount()
    const account = wrapper.findAllComponents(router_link_stub).at(-1)
    expect(account.props('to')).toBe('/account')
  })

  it('falls back to Account when signed in without a name', () => {
    mock_current_user.value = { uid: 'u1' }
    mock_me.value = {}
    const wrapper = mount()
    expect(wrapper.get('a[href="/account"]').attributes('aria-label')).toBe(
      'Account'
    )
  })
})
