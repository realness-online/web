import { shallowMount, mount } from '@vue/test-utils'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'
import * as itemid from '@/helpers/itemid'
import sync from '@/components/sync'
import get_item from '@/modules/item'
import {
  Me,
  Statements,
  Events
} from '@/persistance/Storage'
const fs = require('fs')
const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const statements = get_item(statements_html).statements
const events = [{
  id: '/+16282281824/events/1588035067996',
  url: '/+16282281824/posters/1585005003428'
}]
const fake_props = { propsData: { config: {} } }

describe('@/components/sync', () => {
  let wrapper
  const current_user = {
    phoneNumber: '+16282281824'
  }
  let person

  beforeEach(async () => {
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+14151234356',
      avatar: '/+14151234356/avatars/1578929551564'
    }
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
      wrapper = shallowMount(sync, {
        propsData: { config: {} },
        data () {
          return { syncing: true }
        }
      })
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
  describe('Watchers', () => {
    describe('statement', () => {
      it('Does nothing unless there is a statement', async () => {
        wrapper = shallowMount(sync, fake_props)
        wrapper.setProps({ statement: 'I like to move it' })
        await flushPromises()
        jest.clearAllMocks()
        const save_spy = jest.spyOn(Statements.prototype, 'save')
        wrapper.setProps({ statement: null })
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ statement: 'I like to move it' })
        await flushPromises()
        expect(wrapper.emitted('update:statement')).toBeTruthy()
      })
    })
    describe('person', () => {
      it('Does nothing unless there is a person', async () => {
        wrapper.setProps({ person })
        await flushPromises()
        wrapper.setProps({ person: null })
        const save_spy = jest.spyOn(Me.prototype, 'save')
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        const save_spy = jest.spyOn(Me.prototype, 'save')
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ person })
        await flushPromises()
        expect(save_spy).toBeCalled()
      })
    })
  })
  describe('Methods', () => {
    describe('#update_visit', () => {
      it('Emits an update event for first visit', async () => {
        const load_mock = jest.spyOn(itemid, 'load')
        .mockImplementation(_ => Promise.resolve(person))
        wrapper = await shallowMount(sync, fake_props)
        await flushPromises()
        await wrapper.vm.update_visit()
        expect(load_mock).toBeCalled()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Updated event after proper interval', async () => {
        const too_soon = new Date().getTime() - 10000
        person.visited = new Date(too_soon)
        const load_mock = jest.spyOn(itemid, 'load')
        .mockImplementation(_ => Promise.resolve(person))
        wrapper = await shallowMount(sync, fake_props)
        await flushPromises()
        await wrapper.vm.update_visit()
        expect(load_mock).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
    describe('#auth_state_changed', () => {
      it('Connects sync worker to component', async () => {
        wrapper = await shallowMount(sync, fake_props)
        await flushPromises()
        wrapper.vm.auth_state_changed({ phoneNumber: '+16282281824' })
      })
    })
    describe.only('#sync_paged', () => {
      const index = {}
      beforeEach(async () => {
        wrapper = mount(sync, {
          propsData: { config: {} },
          data () {
            return {
              syncing: true
            }
          }
        })
        await flushPromises()
      })
      it('Syncs if the hash value in the index is different', async () => {
        index['/+16282281824/statements'] = 666
        get.mockImplementationOnce(_ => Promise.resolve(index))
        jest.spyOn(wrapper.vm.$refs.sync, 'querySelector').mockImplementationOnce(_ => {
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
      it('Doesn\'t sync if the hash codes are the same', async () => {
        index['/+16282281824/statements'] = '-209695279'
        get.mockClear()
        get.mockImplementationOnce(_ => Promise.resolve(index))
        jest.spyOn(wrapper.vm.$refs.sync, 'querySelector')
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
        wrapper = mount(sync, {
          propsData: { config: {} },
          data () {
            return {
              syncing: true
            }
          }
        })
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
        wrapper = shallowMount(sync, fake_props)
        await flushPromises()
        wrapper.vm.sync_paged = jest.fn()
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(wrapper.vm.sync_paged).toBeCalled()
      })
    })
    describe('#worker_message', () => {
      const event = {}
      beforeEach(() => {
        wrapper = shallowMount(sync, fake_props)
        event.data = { action: '' }
      })
      it('Calls console.warn if event has unknown action', () => {
        const spy = jest.spyOn(console, 'warn')
        .mockImplementationOnce(_ => null)
        wrapper.vm.worker_message(event)
        expect(spy).toBeCalled()
      })
      it('Calls sync:events via an event', () => {
        const spy = jest.spyOn(wrapper.vm, 'sync_events')
        event.data.action = 'sync:events'
        wrapper.vm.worker_message(event)
        expect(spy).toBeCalled()
      })
      it('Calls sync:statements via an event', () => {
        const spy = jest.spyOn(wrapper.vm, 'sync_statements')
        event.data.action = 'sync:statements'
        wrapper.vm.worker_message(event)
        expect(spy).toBeCalled()
      })
      it('Calls save:poster via an event', () => {
        const spy = jest.spyOn(wrapper.vm, 'save_poster')
        event.data.action = 'save:poster'
        event.data.param = {
          id: '/+16282281824/posters/559666932867',
          outerHTML: poster_html
        }
        wrapper.vm.worker_message(event)
        expect(spy).toBeCalled()
      })
      it('Calls sync:happened via an event', () => {
        event.data.action = 'sync:happened'
        expect(localStorage.sync_time).toBe(undefined)
        wrapper.vm.update_visit = jest.fn()
        wrapper.vm.worker_message(event)
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.vm.update_visit).toBeCalled()
      })
    })
    describe('#itemid', () => {
      it('Returns the user itemid when called without type', async () => {
        expect(localStorage.me).toBe(`/${current_user.phoneNumber}`)
        wrapper = await shallowMount(sync, fake_props)
        await flushPromises()
        expect(wrapper.vm.itemid()).toBe('/+16282281824')
      })
    })
  })
})
