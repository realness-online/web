import { shallowMount } from '@vue/test-utils'
import Account from '@/views/Account'
import * as itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const user = {
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
    firebase.user = user
    localStorage.me = '/+'
    load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(me))
    list_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => Promise.resolve([]))
    wrapper = shallowMount(Account)
  })
  afterEach(() => {
    localStorage.clear()
    firebase.user = null
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
        expect(wrapper.vm.statements_id).toBe('/+/statements')
      })
    })
  })
  describe('#destroy', () => {
    it('Removes the css variable', async () => {
      wrapper.destroy()
    })
  })
  describe('methods', () => {
    describe('#new_avatar', () => {
      it('Handles connecting new avatar to person', async () => {
        const mock_avatar_url = '/+16282281824/avatars/555666777'
        await wrapper.vm.new_avatar(mock_avatar_url)
        await flushPromises()
        expect(wrapper.vm.person.avatar).toBe(mock_avatar_url)
      })
    })
  })
})
