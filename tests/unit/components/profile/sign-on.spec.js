import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
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
        const localVue = createLocalVue()
        localVue.use(VueRouter)
        const router = new VueRouter()
        const wrapper = shallowMount(sign_on, {
          localVue,
          router
        })
        wrapper.vm.sign_on()
        expect(wrapper.vm.$route.path).toBe('/sign-on')
      })
    })
  })
})
