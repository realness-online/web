import { shallowMount, mount } from '@vue/test-utils'
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
    afterEach(() => jest.clearAllMocks())
    describe('Render', () => {
      beforeEach(async () => {
        wrapper = shallowMount(sync)
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
    describe('methods', () => {
      describe('#sync_paged', () => {
        const index = {}
        it('syncs if the hash value in the index is different', async () => {
          wrapper = mount(sync)
          await flushPromises()
          index['/+16282281824/statements'] = 666
          get.mockImplementationOnce(_ => Promise.resolve(index))
          jest.spyOn(wrapper.vm.$el, 'querySelector')
          .mockImplementationOnce(_ => {
            return {
              outerHTML: statements_html
            }
          })
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          await wrapper.vm.sync_statements()
          await flushPromises()
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
          index['/+16282281824/statements'] = '-209695279'
          get.mockClear()
          get.mockImplementationOnce(_ => Promise.resolve(index))
          wrapper = mount(sync)
          jest.spyOn(wrapper.vm.$el, 'querySelector')
          .mockImplementationOnce(_ => {
            return {
              outerHTML: statements_html
            }
          })
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
      describe('#sync_statements', () => {
        it('Calls Statement.sync', async () => {
          wrapper = mount(sync)
          await flushPromises()
          wrapper.vm.statements = statements
          await wrapper.vm.$nextTick()
          get.mockImplementationOnce(_ => Promise.resolve(null))
          await wrapper.vm.sync_statements()
          expect(Statements.prototype.sync).toBeCalled()
        })
      })
      describe('#sync_events', () => {
        it('Calls Event.sync', async () => {
          jest.spyOn(Events.prototype, 'sync')
          .mockImplementationOnce(_ => Promise.resolve(events))
          wrapper = shallowMount(sync)
          await flushPromises()
          wrapper.vm.sync_paged = jest.fn()
          await wrapper.vm.$nextTick()
          await wrapper.vm.sync_events()
          expect(wrapper.vm.sync_paged).toBeCalled()
        })
      })
      describe('#save_statement', () => {
        it('Triggered when statement is set', async () => {
          wrapper = shallowMount(sync)
          const save_spy = jest.spyOn(wrapper.vm, 'save_statement')
          .mockImplementationOnce(_ => Promise.resolve(events))
          await wrapper.setProps({ statement: 'I like to move it' })
          expect(save_spy).toBeCalled()
        })
        it('Emits an event after it saves the statement', async () => {
          wrapper = shallowMount(sync)
          wrapper.setProps({ statement: 'I like to move it' })
          await flushPromises()
          expect(wrapper.emitted('update:statement')).toBeTruthy()
        })
      })
      describe('#worker_message', () => {
        const event = {}
        beforeEach(() => {
          wrapper = shallowMount(sync)
          event.data = { action: '' }
        })
        it('Calls console.warn if event has unknown action', () => {
          const spy = jest.spyOn(console, 'warn')
          .mockImplementationOnce(_ => null)
          wrapper.vm.worker_message(event)
          expect(spy).toBeCalled()
        })
        it('Calls sync_events via an event', () => {
          const spy = jest.spyOn(wrapper.vm, 'sync_events')
          event.data.action = 'sync:events'
          wrapper.vm.worker_message(event)
          expect(spy).toBeCalled()
        })
        it('Calls sync_statements via an event', () => {
          const spy = jest.spyOn(wrapper.vm, 'sync_statements')
          event.data.action = 'sync:statements'
          wrapper.vm.worker_message(event)
          expect(spy).toBeCalled()
        })
        it.todo('calls optimize_statements via an event')
        it.todo('calls optimize_events via an event')
      })
    })
  })
})
