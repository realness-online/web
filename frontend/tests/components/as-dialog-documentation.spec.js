import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'

vi.unmock('@/components/as-dialog-documentation.vue')

const { mock_reset_preferences } = vi.hoisted(() => ({
  mock_reset_preferences: vi.fn()
}))

vi.mock('@/utils/preference', () => ({
  reset_preferences: mock_reset_preferences
}))

vi.mock('@/utils/markdown', () => ({
  documentation_html_parts: () => ({
    before: '<p>Before guide</p>',
    after: '<p>After guide</p>',
    has_install_guide: true
  })
}))

vi.mock('@/prerender/toc', () => ({
  documentation_toc: [
    { id: 'overview', title: 'Overview', level: 2 },
    { id: 'prefs', title: 'Prefs', level: 3 }
  ]
}))

vi.mock('@/components/install-guide.vue', () => ({
  default: {
    name: 'InstallGuide',
    template: '<div class="install-guide-stub" />'
  }
}))

vi.mock('@/components/preferences-menu.vue', () => ({
  default: {
    name: 'PreferencesMenu',
    template: '<menu class="preferences-menu-stub" />'
  }
}))

import AsDialogDocumentation from '@/components/as-dialog-documentation.vue'

const mount = () =>
  shallowMount(AsDialogDocumentation, {
    attachTo: document.body,
    global: {
      stubs: {
        'install-guide': true,
        'preferences-menu': true
      }
    }
  })

describe('@/components/as-dialog-documentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('renders documentation chrome and toc', () => {
    const wrapper = mount()
    expect(wrapper.find('dialog#documentation').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toBe('Documentation')
    const toc = wrapper.findAll('nav[aria-label="Table of contents"] a')
    expect(toc).toHaveLength(2)
    expect(toc[0].text()).toBe('Overview')
    wrapper.unmount()
  })

  it('opens via show(), mounts html, and reveals the install guide', async () => {
    const wrapper = mount()
    const dialog = wrapper.find('dialog#documentation').element
    expect(dialog.open).toBe(false)

    await wrapper.vm.show()
    await flushPromises()

    expect(dialog.open).toBe(true)
    // before_ref content is set via innerHTML on the first content section
    const content = wrapper.find('section[itemprop="content"]')
    expect(content.exists()).toBe(true)
    expect(content.element.innerHTML || '').toBeDefined()
    expect(wrapper.findComponent({ name: 'install-guide' }).exists()).toBe(true)
    wrapper.unmount()
  })

  it('closes when show() is called while open', async () => {
    const wrapper = mount()
    await wrapper.vm.show()
    await flushPromises()
    await wrapper.vm.show()
    await flushPromises()
    expect(wrapper.find('dialog#documentation').element.open).toBe(false)
    wrapper.unmount()
  })

  it('closes on backdrop click', async () => {
    const wrapper = mount()
    await wrapper.vm.show()
    await flushPromises()
    const dialog = wrapper.find('dialog#documentation')
    await dialog.trigger('click')
    expect(dialog.element.open).toBe(false)
    wrapper.unmount()
  })

  it('resets preferences when Reset is clicked', async () => {
    const wrapper = mount()
    await wrapper.find('button').trigger('click')
    expect(mock_reset_preferences).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('scrolls to a toc section', async () => {
    const target = document.createElement('div')
    target.id = 'overview'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    const wrapper = mount()
    await wrapper.find('nav[aria-label="Table of contents"] a').trigger('click')
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    wrapper.unmount()
  })
})
