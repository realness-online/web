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
    element.show = vi.fn(() => {
      element.open = true
    })
    element.showModal = vi.fn()
    element.close = vi.fn(() => {
      element.open = false
    })
  })

  it('starts shut', () => {
    expect(element.open).toBeFalsy()
  })

  it('opens on request', () => {
    wrapper.vm.open()
    expect(element.show).toHaveBeenCalled()
  })

  it('does not re-open a dialog that is already open', () => {
    wrapper.vm.open()
    wrapper.vm.open()
    expect(element.show).toHaveBeenCalledTimes(1)
  })

  // A modal dialog sits in the top layer, above the reCAPTCHA challenge
  // Google appends to the body. Staying non-modal is the whole fix.
  it('never goes modal, so the captcha challenge can paint over it', () => {
    wrapper.vm.open()
    expect(element.showModal).not.toHaveBeenCalled()
  })

  it('raises a scrim while it is open and drops it on close', async () => {
    expect(wrapper.find('#sign-on-scrim').exists()).toBe(false)

    wrapper.vm.open()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#sign-on-scrim').exists()).toBe(true)

    wrapper.vm.close()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#sign-on-scrim').exists()).toBe(false)
  })

  it('closes on escape, which a non-modal dialog does not do on its own', async () => {
    wrapper.vm.open()
    await wrapper.find('dialog#sign-on').trigger('keydown.esc')

    expect(element.close).toHaveBeenCalled()
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
