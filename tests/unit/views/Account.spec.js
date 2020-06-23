import { shallow } from 'vue-test-utils'
import Account from '@/views/Account'
import itemid from '@/helpers/itemid'
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
describe('@/views/Account.vue', () => {
  let wrapper, load_spy, list_spy
  beforeEach(() => {
    localStorage.setItem('me', '/+')
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged, currentUser }
    })
    load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(me))
    list_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => Promise.resolve(null))
    wrapper = shallow(Account)
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  it('Renders account information', async () => {
    await flushPromises()
    expect(load_spy).toBeCalled()
    expect(list_spy).toBeCalled()
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('computed', () => {
    describe('#itemid', () => {
      it('give the current users id', async () => {
        expect(wrapper.vm.itemid).toBe('/+/statements')
      })
    })
  })
  describe('methods', () => {
    describe('#save_page', () => {
      it('Saves a user', async () => {
        const save_spy = jest.spyOn(wrapper.vm.statements_storage, 'save')
        await wrapper.vm.save_statements()
        await flushPromises()
        expect(save_spy).toBeCalled()
      })
    })
    describe('#save_me', () => {
      it('Saves a user', async () => {
        const save_spy = jest.spyOn(wrapper.vm.me_storage, 'save')
        await wrapper.vm.save_me()
        await flushPromises()
        expect(save_spy).toBeCalled()
      })
    })
    describe('#new_avatar', () => {
      it('writes a new avatar', async () => {
        await wrapper.vm.new_avatar('/+/avatrars/4444555657674tu')
      })
    })
  })
})
