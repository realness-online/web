import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import Account from '@/views/Account'
import profile_id from '@/models/profile_id'
import { person_local } from '@/modules/LocalStorage'
import flushPromises from 'flush-promises'
describe('@/views/Account.vue', () => {
  let wrapper
  const me = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    id: '/+16282281824'
  }
  beforeEach(() => {
    jest.spyOn(profile_id, 'load').mockImplementation(() => Promise.resolve(me))
    wrapper = shallow(Account)
  })
  it('Renders account information', async() => {
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
  describe.only('#save_me', () => {
    it('saves a user', async() => {
      const spy = jest.spyOn(person_local, 'save')
      .mockImplementation(() => Promise.resolve('spy'))
      await wrapper.vm.save_me()
      await flushPromises()
      expect(spy).toBeCalled()
    })
  })
})
// const localVue = createLocalVue()
// localVue.use(VueRouter)
// const router = new VueRouter()
// let wrapper = shallow(Account, {
//   localVue,
//   router
// })
