import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
import Account from '@/views/Account'
import * as itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import firebase from 'firebase/app'
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
  describe('Renders', () => {
    it('Renders account information', async () => {
      await flushPromises()
      expect(load_spy).toBeCalled()
      expect(list_spy).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.statements_id', () => {
      it('give the current users id', async () => {
        expect(wrapper.vm.statements_id).toBe('/+16282281824/statements')
      })
    })
  })
  describe('Methods', () => {
    beforeEach(() => {
      const localVue = createLocalVue()
      localVue.use(VueRouter)
      const router = new VueRouter({
        routes: [
          { path: '/', name: 'home' },
          { path: '/signon', name: 'signon' }
        ]
      })
      wrapper = shallowMount(Account, { localVue, router })
    })
    describe('#is_editable', () => {
      it('returns true if statements are the first page', () => {
        const mock_statements = [
          { id: '/+16282281824/statements/1569168047725' },
          { id: '/+16282281824/statements/1569909292018' },
          { id: '/+16282281824/statements/1569909311638' }
        ]
        wrapper.vm.first_page = mock_statements
        expect(wrapper.vm.is_editable(mock_statements)).toBe(true)
      })
      it('returns false if statements are the another page', () => {
        const mock_statements = [
          { id: '/+16282281824/statements/1569168047725' },
          { id: '/+16282281824/statements/1569909292018' },
          { id: '/+16282281824/statements/1569909311638' }
        ]
        wrapper.vm.first_page = []
        expect(wrapper.vm.is_editable(mock_statements)).toBe(false)
      })
      it('returns false if the component is working', () => {
        wrapper.vm.working = true
        expect(wrapper.vm.is_editable([])).toBe(false)
      })
    })
    describe('#signoff', () => {
      it('Signs the user out', () => {
        wrapper.vm.signoff()
        expect(firebase.auth().signOut).toBeCalled()
        expect(wrapper.vm.$route.path).toBe('/sign-on')
      })
    })
    describe('#home', () => {
      it('Takes the user to the homepage', () => {
        wrapper.vm.home()
        expect(wrapper.vm.$route.path).toBe('/')
      })
    })
    describe('#thought_focused', () => {
      it('run when an editable statement is focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_focused(statement)
      })
    })
    describe('#thought_blurred', () => {
      it('Run when an editable statement is focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_shown = jest.spyOn(wrapper.vm, 'thought_shown')
        wrapper.vm.thought_shown.mockImplementationOnce(() => true)
        wrapper.vm.currently_focused = statement.id
        wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).toBeCalled()
      })
      it('Only Runs when focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_shown = jest.spyOn(wrapper.vm, 'thought_shown')
        wrapper.vm.thought_shown.mockImplementationOnce(() => true)
        wrapper.vm.currently_focused = '/some/one/else'
        wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).not.toBeCalled()
      })
    })
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
    describe('#get_all_my_stuff', () => {
      it('handles empty person', () => {
        load_spy = jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(null))
        wrapper.vm.get_all_my_stuff()
        expect(load_spy).toBeCalled()
      })
    })
  })
})
