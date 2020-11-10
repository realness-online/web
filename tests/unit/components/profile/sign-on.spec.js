import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
import sign_on from '@/components/profile/sign-on'
describe('@/components/profile/sign-on', () => {
  it('Renders sign on button', () => {
    const wrapper = shallowMount(sign_on)
    expect(wrapper.element).toMatchSnapshot()
  })
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
