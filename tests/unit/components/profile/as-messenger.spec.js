import { shallowMount } from '@vue/test-utils'
import as_messenger from '@/components/profile/as-messenger'
describe('@/components/profile/as-messenger', () => {
  it('Renders messenger button to message people directly', () => {
    const wrapper = shallowMount(as_messenger, {
      propsData: { itemid: '/+16282281824' }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('methods', () => {
    describe('open_sms_app', () => {
      it('launches the messaging app the user prefers for phone numbers', () => {
        const wrapper = shallowMount(as_messenger, {
          propsData: { itemid: '/+16282281824' }
        })
        window.open = jest.fn()
        wrapper.vm.open_sms_app()
        expect(window.open).toBeCalled()
      })
    })
  })
})
