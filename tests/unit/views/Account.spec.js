import { shallow } from 'vue-test-utils'
import Account from '@/views/Account'
import itemid from '@/helpers/itemid'
import { Me } from '@/persistance/Storage'
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
    load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(me))
    wrapper = shallow(Account)
  })
  it ('Renders account information', async () => {
    await flushPromises()
    expect(load_spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
  describe ('#save_me', () => {
    it ('Saves a user', async () => {
      const spy = jest.spyOn(Me, 'save').mockImplementation(_ => {
        Promise.resolve('spy')
      })
      await wrapper.vm.save_me()
      await flushPromises()
      expect(spy).toBeCalled()
    })
  })
})
