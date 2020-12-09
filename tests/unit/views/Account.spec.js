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
    localStorage.me = '/+16282281824'
    load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(me))
    list_spy = jest.spyOn(itemid, 'list').mockImplementation(_ => Promise.resolve([]))
    wrapper = shallowMount(Account)
  })
  afterEach(() => {
    localStorage.clear()
    firebase.user = null
  })

  describe('Rendering', () => {
    it('Renders account information', async () => {
      await flushPromises()
      expect(load_spy).toBeCalled()
      expect(list_spy).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('computed:', () => {
    describe('#statements_id', () => {
      it('give the current users id', async () => {
        expect(wrapper.vm.statements_id).toBe('/+16282281824/statements')
      })
    })
  })
  describe('methods:', () => {
    describe('#thought_shown', () => {
      const statements = [
        { id: '/+16282281824/statements/1569168047725' },
        { id: '/+16282281824/statements/1569909292018' },
        { id: '/+16282281824/statements/1569909311638' }
      ]
      it('Checks if it\'s time to load more thoughts', async () => {
        jest.spyOn(itemid, 'as_directory').mockImplementation(_ => {
          return { items: ['index', '1569909311638'] }
        })
        wrapper.vm.statements = statements
        await wrapper.vm.thought_shown(statements)
      })
    })
    describe('#slot_key', () => {
      const item = { id: '/+16282281824/statements/1569168047725' }
      it('determines the slot key of an item', () => {
        const key = wrapper.vm.slot_key(item)
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
      it('determines the slot key of an array of items', () => {
        const key = wrapper.vm.slot_key([item])
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
    })
  })
})
