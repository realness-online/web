import { shallowMount } from '@vue/test-utils'
import sign_on from '@/components/profile/sign-on'
describe('@/components/profile/sign-on', () => {
  describe('Renders', () => {
    it('Sign on button', () => {
      const wrapper = shallowMount(sign_on)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#sign_on', () => {
      it('Takes you to the sign-on page when clicked', () => {
        const $router = { push: jest.fn() }
        const wrapper = shallowMount(sign_on, {
          global: {
            mocks: { $router }
          }
        })
        wrapper.vm.sign_on()
        expect($router.push).toHaveBeenCalledTimes(1)
        expect($router.push).toHaveBeenCalledWith({ path: '/sign-on' })
      })
    })
  })
})
