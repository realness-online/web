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
      const invalid_person = { mobile: '415123456a' }
      wrapper = await shallowMount(as_form, {
        props: { person: invalid_person }
      })
      await flushPromises()
      button = wrapper.find('#authorize')
      expect(wrapper.vm.disabled_sign_in).toBe(true)
      expect(button.attributes('disabled')).toBe('')
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
        data() {
          return {
            show_code: true,
            authorizer: { confirm: confirm_spy }
          }
        }
      })
      await flushPromises()
      button = wrapper.find('#submit-verification')
    })

    it('Signs the user in', async () => {
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
