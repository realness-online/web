import { shallow, mount } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'
import sync from '@/components/sync'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import get_item from '@/modules/item'
import {
  Statements,
  Events
} from '@/persistance/Storage'
const fs = require('fs')
const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const statements = get_item(statements_html).statements
const events = [{
  id: '/+16282281824/events/1588035067996',
  url: '/+16282281824/posters/1585005003428'
}]
describe('@/components/sync', () => {
  let wrapper
  const currentUser = {
    phoneNumber: '+16282281824'
  }
  beforeEach(async () => {
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged }
    })
    localStorage.me = `/${currentUser.phoneNumber}`
    jest.spyOn(Statements.prototype, 'sync').mockImplementation(_ => {
      return Promise.resolve(statements)
    })
    jest.spyOn(Statements.prototype, 'save').mockImplementation(_ => {
      return jest.fn(() => Promise.resolve())
    })
    jest.spyOn(Events.prototype, 'save').mockImplementation(_ => {
      return jest.fn(() => Promise.resolve())
    })
    jest.spyOn(Events.prototype, 'sync').mockImplementation(_ => {
      return Promise.resolve(null)
    })
    get.mockImplementation(_ => Promise.resolve([]))
    set.mockImplementation(_ => Promise.resolve(null))
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('initial render', () => {
    beforeEach(async () => {
      wrapper = shallow(sync)
      await flushPromises()
    })
    it('Renders sync component', async () => {
      expect(wrapper.element).toMatchSnapshot()
      wrapper.destroy()
    })
    it('Terminates worker on destroy', async () => {
      wrapper.destroy()
    })
    it('calls sync when service comes back from being offline', () => {
      const sync_mock = jest.fn()
      wrapper.vm.sync = sync_mock
      wrapper.vm.online()
      expect(sync_mock).toBeCalled()
    })
  })
  describe('Syncronzing localstorage', () => {
    it('only syncs if logged in', () => {
      wrapper = shallow(sync)
      wrapper.vm.sync_statements = jest.fn()
      wrapper.vm.sync_events = jest.fn()
      wrapper.vm.sync() // call without current user
      expect(wrapper.vm.sync_statements).not.toBeCalled()
      expect(wrapper.vm.sync_events).not.toBeCalled()
    })
    describe('Paged', () => {
      describe('Statements', () => {
        const index = {}
        it('syncs if there is nothing in the index', async () => {
          wrapper = mount(sync)
          await flushPromises()
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          get.mockImplementationOnce(_ => Promise.resolve(null))
          await wrapper.vm.sync_statements()
          expect(Statements.prototype.save).toBeCalled()
          expect(localStorage.removeItem).toBeCalled() // removes anonymously posted stuff
          expect(set).toBeCalled()
        })
        it('syncs if the hash value in the index is different', async () => {
          wrapper = mount(sync)
          await flushPromises()
          index['/+16282281824/statements'] = 666
          get.mockImplementationOnce(_ => Promise.resolve(index))
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          await wrapper.vm.sync_statements()
          expect(Statements.prototype.save).toBeCalled()
          expect(localStorage.removeItem).toBeCalled() // removes anonymously posted stuff
          expect(set).toBeCalled()
        })
        it('doesn\'t sync if the hash codes are the same', async () => {
          index['/+16282281824/statements'] = '1673738775'
          get.mockImplementationOnce(_ => Promise.resolve(index))
          wrapper = mount(sync)
          await flushPromises()
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          wrapper.vm.sync_statements()
          expect(Statements.prototype.save).not.toBeCalled()
          expect(localStorage.removeItem).not.toBeCalled() // removes anonymously posted stuff
          expect(set).not.toBeCalled()
          index['/+16282281824/statements'] = null
        })
      })
      describe('Events', () => {
        it('syncs like statements', async () => {
          jest.spyOn(Events.prototype, 'sync').mockImplementation(_ => {
            return Promise.resolve(events)
          })
          wrapper = shallow(sync)
          await flushPromises()
          wrapper.vm.sync_paged = jest.fn()
          await wrapper.vm.$nextTick()
          await wrapper.vm.sync_events()
          expect(wrapper.vm.sync_paged).toBeCalled()
        })
      })
    })
    describe('Large', () => {
      it.todo('Posters')
      it.todo('Avatars')
    })
    it.todo('Profile')
  })
  describe('Sync worker', () => {
    describe('Syncronzing IndexDB:', () => {
      // The application loads the data
      // the syncronizer deletes what's stale
      it.todo('Keeps track of how old items are')
      it.todo('Checks if a resourse has been updated')
      it.todo('Removes any items that are no longer in sync with what\'s current')
    })
    describe('Frequency:', () => {
      it.todo('Checks every 5 minutes for updates from users who have posted recently')
      it.todo('Check once per session for people who haven\'t posted in a while')
      it.todo('will rely on peer to peer for updates sooner than five minutes')
    })
    describe('Peer syncing:', () => {
      it.todo('contacts a signaling server to determine available peers')
      it.todo('Connects to available peer')
      it.todo('share indexes with peer')
      it.todo('shares updates with peers')
    })
  })
})
