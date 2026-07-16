import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import Documentation from '@/views/Documentation.vue'

const { mock_replace, mock_reset_preferences } = vi.hoisted(() => ({
  mock_replace: vi.fn(),
  mock_reset_preferences: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mock_replace })
}))

vi.mock('@/utils/preference', () => ({
  reset_preferences: mock_reset_preferences
}))

vi.mock('@/utils/markdown', () => ({
  documentation_html_parts: () => ({
    before:
      '<h2 id="overview">Overview</h2><p><a href="#quick-start">Jump</a></p>',
    after: '<h3 id="quick-start">Quick start</h3>',
    realness: '<h2 id="realness">Realness of your own</h2><p>Prompt body</p>',
    has_install_guide: true
  }),
  changelog_html: () => '<h3 id="changelog-entry">1.0.0</h3><p>Shipped</p>'
}))

vi.mock('@/prerender/toc', () => ({
  documentation_toc: [
    { id: 'overview', title: 'Overview', level: 2 },
    { id: 'quick-start', title: 'Quick start', level: 3 },
    { id: 'preferences', title: 'Preferences', level: 2 },
    { id: 'changelog', title: 'Changelog', level: 2 }
  ]
}))

vi.mock('@/content/agent-prompt-instance.md?raw', () => ({
  default: 'Build your own Realness instance.'
}))

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class"><slot /></a>'
}

const mount = () =>
  shallowMount(Documentation, {
    attachTo: document.body,
    global: {
      stubs: {
        'install-guide': true,
        'preferences-menu': true,
        'router-link': router_link_stub
      }
    }
  })

describe('@/views/Documentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.stubGlobal('innerHeight', 900)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders documentation chrome, toc, guide, prefs, and changelog', () => {
    const wrapper = mount()
    expect(wrapper.find('section#docs[data-page]').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Documentation')
    expect(
      wrapper.findAll('nav[aria-label="Table of contents"] a')
    ).toHaveLength(4)
    expect(wrapper.findComponent({ name: 'install-guide' }).exists()).toBe(true)
    expect(wrapper.find('#preferences').text()).toBe('Preferences')
    expect(wrapper.findComponent({ name: 'preferences-menu' }).exists()).toBe(
      true
    )
    expect(wrapper.find('#changelog').text()).toBe('Changelog')
    expect(wrapper.find('[itemprop="changelog"]').html()).toContain('Shipped')
    wrapper.unmount()
  })

  it('resets preferences from the preferences panel', async () => {
    const wrapper = mount()
    await wrapper
      .find('[itemprop="preferences"] header button')
      .trigger('click')
    expect(mock_reset_preferences).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('copies the instance prompt and shows feedback', async () => {
    vi.useFakeTimers()
    const write_text = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: write_text }
    })

    const wrapper = mount()
    const button = wrapper.find('button[aria-label="Copy prompt"]')
    expect(button.text()).toBe('Copy prompt')
    await button.trigger('click')
    await flushPromises()
    expect(write_text).toHaveBeenCalledWith('Build your own Realness instance.')
    expect(button.text()).toBe('Copied')

    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(button.text()).toBe('Copy prompt')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('routes in-page content links through the router', async () => {
    const wrapper = mount()
    const link = document.createElement('a')
    link.setAttribute('href', '#quick-start')
    const content = wrapper.find('section[itemprop="content"]')
    content.element.appendChild(link)

    link.click()
    await flushPromises()
    expect(mock_replace).toHaveBeenCalledWith({ hash: '#quick-start' })
    wrapper.unmount()
  })

  it('marks the nearest heading active on scroll', async () => {
    const wrapper = mount()
    const overview = document.createElement('h2')
    overview.id = 'overview'
    overview.getBoundingClientRect = () => ({ top: 280 })
    const quick = document.createElement('h3')
    quick.id = 'quick-start'
    quick.getBoundingClientRect = () => ({ top: 800 })

    const content = wrapper.find('section[itemprop="content"]')
    content.element.prepend(overview, quick)

    window.dispatchEvent(new Event('scroll'))
    await flushPromises()

    const active = wrapper.find(
      'nav[aria-label="Table of contents"] a[aria-current="true"]'
    )
    expect(active.exists()).toBe(true)
    expect(active.attributes('href')).toBe('#overview')
    wrapper.unmount()
  })
})
