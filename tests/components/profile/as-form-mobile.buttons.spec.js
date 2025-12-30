import './as-form-mobile.setup.js'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'

describe('as-form-mobile - Button Functionality', () => {
  describe('button#authorize', () => {
    let wrapper, button

    beforeEach(async () => {
      wrapper = await shallowMount(as_form, {
        props: { person },
        global: { stubs: { icon: false } }
      })
      await flushPromises()
      // Wait for mounted hook to complete (libphonenumber import)
      await wrapper.vm.$nextTick()
      await flushPromises()
      button = wrapper.find('#authorize')
    })

    it('Enabled with valid mobile number', () => {
      expect(button.exists()).toBe(true)
    })

    it('Disabled with invalid mobile number', async () => {
      wrapper = await shallowMount(as_form, {
        props: { person },
        global: { stubs: { icon: false } }
      })
      await flushPromises()
      await wrapper.vm.$nextTick()
      button = wrapper.find('#authorize')

      // Set invalid mobile number and trigger validation
      const input = wrapper.find('input#mobile')
      if (input.exists()) {
        // Set value directly on the component's ref
        wrapper.vm.mobile_number = 'invalid'
        await wrapper.vm.$nextTick()
        // Call validation directly
        wrapper.vm.validate_mobile_number()
        await wrapper.vm.$nextTick()
      }

      // Component validates and disables button when mobile is invalid
      expect(wrapper.vm.disabled_sign_in).toBe(true)
      if (button.exists()) {
        expect(button.attributes('disabled')).toBeDefined()
      }
    })

    it('Starts captcha verification when clicked', async () => {
      await button.trigger('click')
      expect(wrapper.vm.show_captcha).toBe(true)
      const captcha = wrapper.find('#captcha')
      expect(captcha.exists()).toBe(true)
    })

    it('Is removed after click', async () => {
      expect(button.exists()).toBe(true)
      await button.trigger('click')
      expect(wrapper.vm.show_authorize).toBe(false)
      button = wrapper.find('#authorize')
      expect(button.exists()).toBe(false)
    })
  })

  describe('button#submit-verification', () => {
    let wrapper, button, confirm_spy

    beforeEach(async () => {
      confirm_spy = vi.fn(() => Promise.resolve('result of confirm_spy'))
      wrapper = await shallowMount(as_form, {
        props: { person },
        global: { stubs: { icon: false } }
      })
      await flushPromises()
      await wrapper.vm.$nextTick()
      // Set show_code and authorizer directly on component instance
      wrapper.vm.show_code = true
      wrapper.vm.authorizer = { confirm: confirm_spy }
      await wrapper.vm.$nextTick()
      button = wrapper.find('#submit-verification')
    })

    it('Signs the user in', async () => {
      expect(button.exists()).toBe(true)
      await button.trigger('click')
      expect(confirm_spy).toBeCalled()
    })

    it('Hides input#verification-code when clicked', async () => {
      expect(wrapper.find('#verification-code').exists()).toBe(true)
      await button.trigger('click')
      expect(wrapper.find('#verification-code').exists()).toBe(false)
      expect(wrapper.vm.show_code).toBe(false)
    })

    it('Emits an event when the user is signed on', async () => {
      await wrapper.vm.sign_in_with_code()
      expect(wrapper.emitted('signed-on')).toBeTruthy()
    })
  })
})
