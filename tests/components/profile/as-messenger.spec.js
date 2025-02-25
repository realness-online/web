import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_messenger from '@/components/profile/as-messenger'
describe('@/components/profile/as-messenger', () => {
  describe('Renders', () => {
    it('Messenger button', () => {
      const wrapper = shallowMount(as_messenger, {
        props: { itemid: '/+16282281824' }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#open_sms_app', () => {
      it('Launches the messaging app the user prefers for phone numbers', () => {
        const wrapper = shallowMount(as_messenger, {
          props: { itemid: '/+16282281824' }
        })
        window.open = vi.fn()
        wrapper.vm.open_sms_app()
        expect(window.open).toBeCalled()
      })
    })
  })
})
