import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Pricing from '@/views/Pricing.vue'

const mock_route = reactive({ params: {} })

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: vi.fn() })
}))

describe('@/views/Pricing', () => {
  const mount_pricing = () =>
    mount(Pricing, {
      global: {
        stubs: {
          'logo-as-link': true,
          'sponsor-cta': true,
          'as-prompt-agent': true,
          'router-link': true
        }
      }
    })

  it('renders the pricing page with header', () => {
    const wrapper = mount_pricing()
    expect(wrapper.find('section#pricing.page').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Pricing')
    expect(wrapper.text()).toContain('Realness is free to use')
    expect(wrapper.text()).toContain('it has a price')
  })

  it('renders tier navigation with all three tiers', () => {
    const wrapper = mount_pricing()
    const nav = wrapper.find("nav[aria-label='Pricing tiers']")
    expect(nav.exists()).toBe(true)
    const links = nav.findAll('router-link-stub')
    expect(links).toHaveLength(3)
    // The stub doesn't render slot text; read the destination off the `to` prop.
    expect(links[0].attributes('to')).toBe('/pricing/endorse')
    expect(links[1].attributes('to')).toBe('/pricing/teams')
    expect(links[2].attributes('to')).toBe('/pricing/enterprise')
    // The active tier is marked with aria-current.
    expect(links[0].attributes('aria-current')).toBe('page')
    expect(links[1].attributes('aria-current')).toBeUndefined()
  })

  it('shows one tier at a time (endorse by default)', () => {
    const wrapper = mount_pricing()
    const carousel = wrapper.find("section[aria-label='Tier carousel']")
    const articles = carousel.findAll('article')
    expect(articles).toHaveLength(1)
    expect(articles[0].text()).toContain('Endorse')
    expect(articles[0].text()).toContain('Photo to poster')
    expect(articles[0].text()).toContain('Commercial use')
  })

  it('renders one sponsor cta for the active tier', () => {
    const wrapper = mount_pricing()
    expect(wrapper.findAll('sponsor-cta-stub')).toHaveLength(1)
  })

  it('does not render the actions row for the endorse tier', () => {
    const wrapper = mount_pricing()
    expect(wrapper.find("menu[aria-label='Actions']").exists()).toBe(false)
  })

  // Tier switching drives through go_to() (tier nav links and touch swipe
  // both call it); exercise it directly against the component's reactive
  // state rather than the transitioning DOM.
  it('advances to the next tier via next()', async () => {
    const wrapper = mount_pricing()
    wrapper.vm.next()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.active_index).toBe(1)
    expect(wrapper.vm.active_slug).toBe('teams')
  })

  it('wraps around to the last tier via prev() from the first', async () => {
    const wrapper = mount_pricing()
    wrapper.vm.prev()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.active_index).toBe(2)
    expect(wrapper.vm.active_slug).toBe('enterprise')
  })

  it('renders the actions row for the teams tier when active', () => {
    mock_route.params.tier = 'teams'
    const wrapper = mount_pricing()
    expect(wrapper.find("menu[aria-label='Actions']").exists()).toBe(true)
  })

  afterEach(() => {
    mock_route.params = {}
  })
})
