import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'

vi.unmock('@/components/profile/as-dialog-preferences.vue')

vi.mock('@/components/preferences-menu', () => ({
  default: {
    name: 'PreferencesMenu',
    template: '<menu class="preferences-menu-stub" />'
  }
}))

vi.mock('@/components/icon', () => ({
  default: {
    name: 'icon',
    props: ['name'],
    template: '<svg class="icon-stub" />'
  }
}))

import AsDialogPreferences from '@/components/profile/as-dialog-preferences.vue'

const mount = () =>
  shallowMount(AsDialogPreferences, {
    attachTo: document.body
  })

describe('@/components/profile/as-dialog-preferences', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the settings button and dialog', () => {
    const wrapper = mount()
    expect(wrapper.find('button[aria-label="Settings"]').exists()).toBe(true)
    expect(wrapper.find('dialog#preferences').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Settings')
    wrapper.unmount()
  })

  it('opens and closes the dialog via show()', async () => {
    const wrapper = mount()
    const dialog = wrapper.find('dialog#preferences').element
    expect(dialog.open).toBe(false)

    await wrapper.vm.show()
    await flushPromises()
    expect(dialog.open).toBe(true)

    await wrapper.vm.show()
    await flushPromises()
    expect(dialog.open).toBe(false)
    wrapper.unmount()
  })

  it('closes when the backdrop is clicked', async () => {
    const wrapper = mount()
    await wrapper.vm.show()
    await flushPromises()
    const dialog = wrapper.find('dialog#preferences')
    await dialog.trigger('click')
    expect(dialog.element.open).toBe(false)
    wrapper.unmount()
  })
})
