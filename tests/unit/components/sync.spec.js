import { shallowMount, mount, flushPromises } from '@vue/test-utils'
import { get, set, del } from 'idb-keyval'
import * as itemid from '@/use/itemid'
import * as sync_worker from '@/persistance/Cloud.sync'
import sync from '@/components/sync'
import get_item from '@/use/item'
import { Me, Statements, Events, Poster } from '@/persistance/Storage'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const fs = require('fs')
const statements_html = fs.readFileSync(
  './tests/unit/html/statements.html',
  'utf8'
)
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const offline_poster = fs.readFileSync(
  './tests/unit/html/poster-offline.html',
  'utf8'
)
const person_html = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const events_html = fs.readFileSync('./tests/unit/html/events.html', 'utf8')
const statements = get_item(statements_html).statements
const events = get_item(events_html).events
const fake_props = {
  global: {
    stubs: ['router-link', 'router-view']
  },
  props: { config: {} }
}
const statement = {
  id: '/+16282281824',
  type: 'statements',
  statement: 'I like to move it'
}
const current_user = {
  phoneNumber: '+16282281824'
}
describe('@/components/sync', () => {
  let wrapper
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
    jest
      .spyOn(Statements.prototype, 'sync')
      .mockImplementation(() => Promise.resolve(statements))
    jest
      .spyOn(Statements.prototype, 'save')
      .mockImplementation(() => Promise.resolve())
    jest
      .spyOn(Events.prototype, 'sync')
      .mockImplementation(() => Promise.resolve(events))
    jest
      .spyOn(Events.prototype, 'save')
      .mockImplementation(() => Promise.resolve())
    set.mockImplementation(() => Promise.resolve(null))
    wrapper = await shallowMount(sync, fake_props)
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    firebase.user = null
  })
  describe('Render', () => {
    it('Renders sync component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Watchers', () => {
    describe('statement', () => {
      it('Does nothing unless there is a statement', async () => {
        wrapper = shallowMount(sync, fake_props)
        wrapper.setProps({ statement })
        await flushPromises()
        jest.clearAllMocks()
        const save_spy = jest.spyOn(Statements.prototype, 'save')
        wrapper.setProps({ statement: null })
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ statement })
        await flushPromises()
        expect(wrapper.emitted('update:statement')).toBeTruthy()
      })
    })
    describe('person', () => {
      it('Does nothing unless there is a person', async () => {
        const props = { ...fake_props }
        props.props.person = person
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
      it('plays the sync when visible', async () => {
        wrapper = await shallowMount(sync, fake_props)
        const play = jest
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.visibility_change()
        expect(play).toBeCalled()
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
        await wrapper.vm.visibility_change()
        expect(document.visibilityState).toBe('hidden')
        expect(wrapper.vm.syncer.postMessage).not.toBeCalled()
      })
    })
    describe('#auth_state_changed', () => {
      it('Connects sync worker to component', async () => {
        wrapper = await shallowMount(sync, fake_props)
        const play = jest
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.auth_state_changed({ phoneNumber: '+16282281824' })
        expect(play).toBeCalled()
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
      let sync_offline_actions_sync
      let sync_me
      let sync_statements
      let sync_events
      let sync_anonymous_posters
      let sync_happened
      beforeEach(() => {
        sync_offline_actions_sync = jest
          .spyOn(sync_worker, 'sync_offline_actions')
          .mockImplementation(() => Promise.resolve())
        sync_me = jest
          .spyOn(wrapper.vm, 'sync_me')
          .mockImplementation(() => Promise.resolve())
        sync_statements = jest
          .spyOn(wrapper.vm, 'sync_statements')
          .mockImplementation(() => Promise.resolve())
        sync_events = jest
          .spyOn(wrapper.vm, 'sync_events')
          .mockImplementation(() => Promise.resolve())
        sync_anonymous_posters = jest
          .spyOn(wrapper.vm, 'sync_anonymous_posters')
          .mockImplementation(() => Promise.resolve())
        sync_happened = jest
          .spyOn(wrapper.vm, 'sync_happened')
          .mockImplementation(() => Promise.resolve())
        firebase.user = current_user
        jest.spyOn(itemid, 'load').mockImplementation(() =>
          Promise.resolve({
            id: '/+16282281824'
          })
        )
      })
      it('Starts syncing without a last_sync', async () => {
        await wrapper.vm.play()
        expect(sync_offline_actions_sync).toBeCalled()
        expect(sync_me).toBeCalled()
        expect(sync_statements).toBeCalled()
        expect(sync_events).toBeCalled()
        expect(sync_anonymous_posters).toBeCalled()
        expect(sync_happened).toBeCalled()
        expect(wrapper.emitted('active').length).toBe(2)
      })
      it('Sets a timer for the remaining time until sync', async () => {
        localStorage.last_sync = new Date().toISOString()
        await wrapper.vm.play()
        expect(sync_offline_actions_sync).toHaveBeenCalledTimes(1)
      })
    })
    describe('#sync_me', () => {
      it('Syncs when the hash between server and local are off', async () => {
        localStorage.setItem(person.id, person_html)
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_me()
        expect(localStorage.getItem(person.id)).toBe(null)
        expect(del).toBeCalled()
      })
      it('Leaves localStorage alone if the hash are equal', async () => {
        localStorage.setItem(person.id, person_html)
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: 'zLEGcdAG1gQg/uS89iaOYQ==' }
          })
        )
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
        jest
          .spyOn(Statements.prototype, 'sync')
          .mockImplementationOnce(() => Promise.resolve([]))
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
        expect(Statements.prototype.save).not.toBeCalled()
      })
      it('Only syncs when the network and local statements differ', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: 'x5qk/9QmVjFHtJtL6pznJQ==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).not.toBeCalled()
      })
      it('Syncs without a network file to sync with', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: null }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
      })
      it('Saves synced statements', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.statements = statements
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_statements()
        expect(Statements.prototype.sync).toBeCalled()
        expect(Statements.prototype.save).toBeCalled()
      })
    })
    describe('#sync_events', () => {
      it('Syncs when there are items to sync', async () => {
        jest
          .spyOn(Events.prototype, 'sync')
          .mockImplementationOnce(() => Promise.resolve([]))
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
        expect(Events.prototype.save).not.toBeCalled()
      })
      it('Only syncs when the network and local statements differ', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: 'mxtr7zxj/Srcm5KRfn8pcA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).not.toBeCalled()
      })
      it('Syncs without a network file to sync with', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: null }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
      })
      it('Saves synced events', async () => {
        jest.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
          Promise.resolve({
            customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
          })
        )
        wrapper = await mount(sync, fake_props)
        await flushPromises()
        wrapper.vm.events = events
        await wrapper.vm.$nextTick()
        await wrapper.vm.sync_events()
        expect(Events.prototype.sync).toBeCalled()
        expect(Events.prototype.save).toBeCalled()
      })
    })
    describe('#sync_anonymous_posters', () => {
      it('Handles no posters', async () => {
        // get.mockImplementationOnce(() => Promise.resolve())
        await wrapper.vm.sync_anonymous_posters()
        expect(get).toBeCalled()
        expect(del).not.toBeCalled()
      })
      it('Syncs anonymous posters', async () => {
        // /+16282281824/posters/559666932867
        const posters = {
          items: ['559666932867']
        }
        get.mockImplementation(itemid => {
          if (itemid === '/+/posters/') return Promise.resolve(posters)
          else if (itemid === '/+/posters/559666932867')
            return Promise.resolve(offline_poster)
          else return Promise.resolve([])
        })
        await flushPromises()
        const save_poster_spy = jest
          .spyOn(wrapper.vm, 'save_poster')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.sync_anonymous_posters()
        await flushPromises()
        expect(get).toHaveBeenCalledTimes(2)
        expect(save_poster_spy).toHaveBeenCalledTimes(1)
        expect(del).toHaveBeenCalledTimes(2)
      })
    })
    describe('#sync_happened', () => {
      it('Updates visit', async () => {
        jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Updates visit for the first time', async () => {
        person.visited = undefined
        jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Updates the visit once per hour', async () => {
        person.visited = new Date().toISOString()
        jest
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        wrapper = await mount(sync, fake_props)
        expect(localStorage.sync_time).toBe(undefined)
        await wrapper.vm.sync_happened()
        await flushPromises()
        expect(localStorage.sync_time).not.toBe(undefined)
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
    describe('#save_poster', () => {
      it('saves a poster that is passed to it as a variable', async () => {
        wrapper = await shallowMount(sync, fake_props)
        const mock_poster = {
          id: `${localStorage.me}/posters/${15323457857456}`,
          outerHTML: poster_html
        }
        const poster_save_spy = jest
          .spyOn(Poster.prototype, 'save')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.save_poster(mock_poster)
        expect(del).toBeCalled()
        expect(poster_save_spy).toBeCalled()
      })
    })
  })
})
