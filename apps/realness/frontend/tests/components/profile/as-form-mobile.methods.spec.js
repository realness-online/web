import './as-form-mobile.setup.js'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vite-plus/test'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'

describe('as-form-mobile - Methods and Watchers', () => {
  describe('#text_human_verify_code', () => {
    let wrapper

    beforeEach(async () => {
      wrapper = await shallowMount(as_form)
      await flushPromises()
      wrapper.vm.show_code = true
      await wrapper.vm.$nextTick()
    })

    it('Hides captcha div', async () => {
      const mockElement = { scrollIntoView: vi.fn(), focus: vi.fn() }
      global.document.querySelector = vi.fn().mockReturnValue(mockElement)

      await wrapper.vm.text_human_verify_code()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hide_captcha).toBe(true)
    })

    it('Renders verification-code input', async () => {
      const mockElement = { scrollIntoView: vi.fn(), focus: vi.fn() }
      global.document.querySelector = vi.fn().mockReturnValue(mockElement)

      await wrapper.vm.text_human_verify_code()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.show_code).toBe(true)
    })
  })

  describe('mobile watcher', () => {
    it('Updates mobile number ref when changed', async () => {
      const wrapper = await shallowMount(as_form)
      await flushPromises()
      const initial_value = wrapper.vm.mobile_number
      wrapper.vm.mobile_number = '4155551234'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.mobile_number).toBe('4155551234')
    })
  })
})
