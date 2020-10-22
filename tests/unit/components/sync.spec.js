import { shallow, mount } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import { get, set, del } from 'idb-keyval'
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
const offline_poster = fs.readFileSync('./tests/unit/html/poster-offline.html', 'utf8')
const events = [{
  id: '/+16282281824/events/1588035067996',
  url: '/+16282281824/posters/1585005003428'
}]
describe('Syncing Edge data', () => {
  describe('@/components/sync', () => {
    let wrapper
    const current_user = {
      phoneNumber: '+16282281824'
    }
    beforeEach(async () => {
      const onAuthStateChanged = jest.fn(state_changed => {
        state_changed(current_user)
      })
      jest.spyOn(firebase, 'auth').mockImplementation(_ => {
        return { onAuthStateChanged }
      })
      localStorage.me = `/${current_user.phoneNumber}`
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
    describe('Render', () => {
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
      it('Check when service comes back from being offline', () => {
        const message_mock = jest.fn()
        wrapper.vm.syncer.postMessage = message_mock
        wrapper.vm.online()
        expect(message_mock).toBeCalled()
      })
    })
    describe('Syncronzing localstorage', () => {
      describe('Statements', () => {
        const index = {}
        it.only('syncs if there is nothing in the index', async () => {
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
          const onAuthStateChanged = jest.fn(state_changed => {
            state_changed(null)
          })
          jest.spyOn(firebase, 'auth').mockImplementation(_ => {
            return { onAuthStateChanged }
          })
          index['/+16282281824/statements'] = '-578232497'
          get.mockClear()
          get.mockImplementationOnce(_ => Promise.resolve(index))
          wrapper = mount(sync)
          await flushPromises()
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          await wrapper.vm.sync_statements()
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
  })
})
