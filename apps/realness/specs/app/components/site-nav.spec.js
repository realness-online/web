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

  it('renders site links away from the home route', () => {
    mock_route.path = '/docs'
    const wrapper = mount()
    const nav = wrapper.find('nav[aria-label="Site"]')
    expect(nav.exists()).toBe(true)
    expect(wrapper.text()).toContain('About')
    expect(wrapper.text()).toContain('Docs')
    expect(wrapper.text()).toContain('Pricing')
    expect(wrapper.text()).not.toContain('License')
    expect(nav.find('a[href="/terms"]').text()).toBe('Legal')
  })

  it('hides the text links on the home route', () => {
    const wrapper = mount()
    expect(wrapper.find('menu[data-primary]').exists()).toBe(false)
    expect(wrapper.find('details[data-nav-more]').exists()).toBe(false)
    expect(wrapper.find('nav > span[data-identity] > a#about').exists()).toBe(
      true
    )
  })

  it('keeps About and Docs in view and folds the rest behind the overflow', () => {
    mock_route.path = '/docs'
    const wrapper = mount()
    const primary = wrapper.get('menu[data-primary]')
    expect(primary.findAll('a').map(link => link.text())).toEqual([
      'About',
      'Docs'
    ])
    const more = wrapper.get('details[data-nav-more] menu')
    expect(more.findAll('a').map(link => link.text())).toEqual([
      'Pricing',
      'Prints',
      'Legal'
    ])
  })

  it('keeps the account icon beside the logo, labeled with the name', () => {
    mock_route.path = '/docs'
    mock_current_user.value = { uid: 'person-1' }
    mock_me.value = { name: 'Scott' }
    const wrapper = mount()
    const account = wrapper.get('nav > span[data-identity] > a#account')
    expect(account.attributes('href')).toBe('/account')
    expect(account.attributes('aria-label')).toBe('Scott')
    expect(account.element.nextElementSibling.tagName).toBe('LOGO-AS-LINK-STUB')
  })

  it('keeps one top bar on the home route, with the version link at the end', () => {
    const wrapper = mount()
    const identity = wrapper.get('nav > span[data-identity]')
    expect(identity.find('logo-as-link-stub').exists()).toBe(false)
    expect(identity.find('a#account').exists()).toBe(false)
    const version = identity.get('a#about')
    expect(version.attributes('href')).toBe('/about')
    expect(version.text()).toContain('?')
    expect(identity.element.lastElementChild).toBe(version.element)
  })

  it('drops the version link away from the home route', () => {
    mock_route.path = '/docs'
    const wrapper = mount()
    expect(wrapper.find('nav > span[data-identity] > a#about').exists()).toBe(
      false
    )
  })

  it('shows the blog back-link on home when arriving from the blog', () => {
    window.history.replaceState(
      { back: 'https://blog.example/post' },
      '',
      '/?from=blog'
    )
    const wrapper = mount()
    const link = wrapper.get(
      'nav > span[data-identity] > a[href="https://blog.example/post"]'
    )
    expect(link.text()).toBe('←')
    wrapper.unmount()
    window.history.replaceState({}, '', '/')
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
})
