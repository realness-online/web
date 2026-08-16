import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import dialog_sign_on from '@/components/profile/as-dialog-sign-on'

const stubs = {
  icon: true,
  'as-sign-on': {
    name: 'AsSignOn',
    template: '<section class="as-sign-on-stub" />'
  }
}

const mount = () =>
  shallowMount(dialog_sign_on, { global: { stubs }, attachTo: document.body })

describe('@/components/profile/as-dialog-sign-on', () => {
  let wrapper
  let element

  beforeEach(() => {
    vi.clearAllMocks()
    wrapper = mount()
    element = wrapper.find('dialog#sign-on').element
    element.showModal = vi.fn(() => {
      element.open = true
    })
    element.close = vi.fn(() => {
      element.open = false
    })
  })

  it('starts shut', () => {
    expect(element.open).toBeFalsy()
  })

  it('opens on request', () => {
    wrapper.vm.open()
    expect(element.showModal).toHaveBeenCalled()
  })

  it('does not re-open a dialog that is already open', () => {
    wrapper.vm.open()
    wrapper.vm.open()
    expect(element.showModal).toHaveBeenCalledTimes(1)
  })

  it('shuts itself and passes the signal on when sign-on succeeds', async () => {
    wrapper.vm.open()
    await wrapper.findComponent({ name: 'AsSignOn' }).vm.$emit('signed_in')

    expect(element.close).toHaveBeenCalled()
    expect(wrapper.emitted('signed_in')).toHaveLength(1)
  })

  it('closes without claiming a sign-in', async () => {
    wrapper.vm.open()
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    expect(element.close).toHaveBeenCalled()
    expect(wrapper.emitted('signed_in')).toBeUndefined()
  })
})
