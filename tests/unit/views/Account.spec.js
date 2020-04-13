import { shallow } from 'vue-test-utils'
import Account from '@/views/Account'
import profile from '@/helpers/profile'
import { person_storage } from '@/persistance/Storage'
import flushPromises from 'flush-promises'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const currentUser = {
  phoneNumber: '+16282281824'
}
const me = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
describe ('@/views/Account.vue', () => {
  let wrapper, load_spy
  beforeEach(() => {
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged, currentUser }
    })
    jest.spyOn(person_storage, 'as_object').mockImplementation(_ => me)
    load_spy = jest.spyOn(profile, 'load').mockImplementation(_ => Promise.resolve(me))
    wrapper = shallow(Account)
  })
  it ('Renders account information', async () => {
    await flushPromises()
    expect(load_spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
  describe ('#save_me', () => {
    it ('Saves a user', async () => {
      const spy = jest.spyOn(person_storage, 'save').mockImplementation(_ => {
        Promise.resolve('spy')
      })
      await wrapper.vm.save_me()
      await flushPromises()
      expect(spy).toBeCalled()
    })
  })
})
