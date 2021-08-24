import { shallowMount, mount } from '@vue/test-utils'
import flushPromises from 'flush-promises'
import { get, set, del } from 'idb-keyval'
import * as itemid from '@/helpers/itemid'
import * as sync_worker from '@/persistance/Cloud'
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
const person_html = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const events_html = fs.readFileSync('./tests/unit/html/events.html', 'utf8')
const statements = get_item(statements_html).statements
const events = get_item(events_html).events
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
      id: '/+16282281824',
      avatar: '/+16282281824/avatars/1578929551564',
      visited: '2020-03-03T17:37:22.943Z'
    }
    localStorage.me = `/${current_user.phoneNumber}`
    jest.spyOn(Statements.prototype, 'sync')
    .mockImplementation(_ => Promise.resolve(statements))
    jest.spyOn(Statements.prototype, 'save')
    .mockImplementation(_ => Promise.resolve())

    jest.spyOn(Events.prototype, 'sync')
    .mockImplementation(_ => Promise.resolve(events))
    jest.spyOn(Events.prototype, 'save')
    .mockImplementation(_ => Promise.resolve())

    get.mockImplementation(_ => Promise.resolve([]))
    set.mockImplementation(_ => Promise.resolve(null))
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
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
        const props = { ...fake_props }
        props.propsData.person = person
        wrapper = shallowMount(sync, props)
        await flushPromises()
        wrapper.setProps({ person: null })
        const save_spy = jest.spyOn(Me.prototype, 'save')
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        localStorage.sync_time = Date.now()
        const save_spy = jest.spyOn(Me.prototype, 'save')
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ person })
        await flushPromises()
        expect(save_spy).toBeCalled()
      })
    })
  })
  describe('Methods', () => {
    describe('#visibility_change', () => {
      it('Tells the sync worker to sync when the UI is visible', async () => {
        let message
        wrapper = await shallowMount(sync, fake_props)
        wrapper.vm.syncer = {
          postMessage: jest.fn(m => { message = m })
        }
        wrapper.vm.visibility_change()
        await flushPromises()
        expect(document.hidden).toBe(false)
        expect(wrapper.vm.syncer.postMessage).toBeCalled()
        expect(message.action).toBe('sync:play')
      })
      it('Is chill when the UI is hidden', async () => {
        wrapper = await shallowMount(sync, fake_props)
        wrapper.vm.syncer = {
          postMessage: jest.fn()
        }
        Object.defineProperty(window.document, 'visibilityState', {
          value: 'hidden'
        })
        // document.visibilityState
        wrapper.vm.visibility_change()
        await flushPromises()
        expect(document.visibilityState).toBe('hidden')
        expect(wrapper.vm.syncer.postMessage).not.toBeCalled()
      })
    })
    describe('#auth_state_changed', () => {
      it('Connects sync worker to component', async () => {
        wrapper = await shallowMount(sync, fake_props)
        await flushPromises()
        wrapper.vm.auth_state_changed({ phoneNumber: '+16282281824' })
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
    describe('#play', () => {
      it('Starts syncing without a last_sync', async () => {
        await wrapper.vm.play()
        expect(post_message_spy).toHaveBeenCalledTimes(2)
      })
      it('Sets a timer for the remaining time until sync', async () => {
        localStorage.last_sync = new Date().toISOString()
        await wrapper.vm.play()
        expect(post_message_spy).not.toBeCalled()
      })
    })
    describe('#sync_me', () => {
      it('Syncs when the hash between server and local are off', async () => {
        localStorage.setItem(person.id, person_html)
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_me()
        expect(localStorage.getItem(person.id)).toBe(null)
        expect(del).toBeCalled()
      })
      it('Leaves localStorage alone if the hash are equal', async () => {
        localStorage.setItem(person.id, person_html)
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '8ae9Lz4qKYqoyofDaaY0Nw==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_me()
        expect(localStorage.getItem(person.id)).not.toBe(null)
        expect(del).not.toBeCalled()
      })
    })
    describe('#sync_statements', () => {
      it('Syncs when there are items to sync', async () => {
        jest.spyOn(Statements.prototype, 'sync')
        .mockImplementationOnce(_ => Promise.resolve([]))
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
        expect(Statements.prototype.save).not.toBeCalled()
      })
      it('Only syncs when the network and local statements differ', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: 'eL7hc0lLvyQjuL+5Gst2Aw==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).not.toBeCalled()
      })
      it('Syncs without a network file to sync with', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: null }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        // get.mockImplementationOnce(_ => Promise.resolve(null))
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
      })
      it('Saves synced statements', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        get.mockImplementationOnce(_ => Promise.resolve(null))
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
        expect(Statements.prototype.save).toBeCalled()
      })
    })
    describe('#sync_events', () => {
      it('Syncs when there are items to sync', async () => {
        jest.spyOn(Events.prototype, 'sync')
        .mockImplementationOnce(_ => Promise.resolve([]))
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
        expect(Events.prototype.save).not.toBeCalled()
      })
      it('Only syncs when the network and local statements differ', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: 'QguENXotCF+R2U6/yNGaVw==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).not.toBeCalled()
      })
      it('Syncs without a network file to sync with', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: null }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        // get.mockImplementationOnce(_ => Promise.resolve(null))
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
      })
      it('Saves synced events', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata')
        .mockImplementation(_ => Promise.resolve({
           customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }))
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        get.mockImplementationOnce(_ => Promise.resolve(null))
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
        expect(Events.prototype.save).toBeCalled()
      })
    })
    describe('#sync_anonymous_posters', () => {
      it('Needs to be signed in', async () => {
        await sync_anonymous_posters()
        expect(get).not.toBeCalled()
      })
      it('Needs to be online', () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        sync.anonymous_posters(user)
        expect(get).not.toBeCalled()
      })
      it('Handles no posters', async () => {
        firebase.user = user
        await sync.anonymous_posters()
        expect(get).toBeCalled()
        expect(del).not.toBeCalled()
      })
      it('Syncs anonymous posters', async () => {
        // /+16282281824/posters/559666932867
        const posters = {
          items: ['559666932867']
        }
        get.mockClear()
        get.mockImplementation(itemid => {
          if (itemid === '/+/posters/') return Promise.resolve(posters)
          else return Promise.resolve(offline_poster)
        })
        firebase.user = user
        await sync.anonymous_posters()
        await flushPromises()
        expect(get).toHaveBeenCalledTimes(2)
        expect(del).toHaveBeenCalledTimes(2)
      })
    })
    describe('#sync_happened', () => {
      it('Updates visit', async () => {
        jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Updates visit for the first time', async () => {
        person.visited = undefined
        jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Updates the visit once per hour', async () => {
        person.visited = new Date().toISOString()
        jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
  })
})
