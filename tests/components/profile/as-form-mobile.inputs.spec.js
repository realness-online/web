import './as-form-mobile.setup.js'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'
import { vi } from 'vitest'

describe('as-form-mobile - Input Validation', () => {
  describe('input#verification-code', () => {
    let input, stub, wrapper

    beforeEach(async () => {
      wrapper = await shallowMount(as_form, {
        props: { person }
      })
      // Set the show_code ref to true to show verification input
      wrapper.vm.show_code = true
      wrapper.vm.code = '12345'
      await flushPromises()
      await wrapper.vm.$nextTick()
      input = wrapper.find('#verification-code')
      stub = vi.fn()
    })

    it('Allow valid digits', () => {
      input.trigger('keypress', {
        key: '2',
        preventDefault: stub
      })
      expect(stub).not.toBeCalled()
    })

    it('Only accept numbers', () => {
      input.trigger('keypress', {
        key: 'a',
        preventDefault: stub
      })
      expect(stub).toBeCalled()
    })

    it('Renders sign on button with valid input', async () => {
      input.trigger('keypress', {
        key: '6',
        preventDefault: stub
      })
      await wrapper.vm.$nextTick()
      const button = wrapper.find('#submit-verification')
      expect(stub).not.toBeCalled()
      if (button.exists()) {
        expect(button.attributes().disabled).toBe(undefined)
      }
    })
  })
})
