import { get, del, keys, set } from 'idb-keyval'
import { Offline } from '@/persistance/Storage'
import {
  prune,
  sync_offline_actions,
  sync_later,
  visit_interval
} from '@/use/sync'
import * as itemid from '@/use/itemid'

const statements_html = read_mock_file('@@/html/statements.html')
const offline_poster = read_mock_file('@@/html/poster-offline.html')
const poster_html = read_mock_file('@@/html/poster.html')
const person_html = read_mock_file('@@/html/person.html')
const events_html = read_mock_file('@@/html/events.html')
const { statements } = get_item(statements_html)
const { events } = get_item(events_html)

const user = { phoneNumber: '+16282281824' }
const local_matches_network = '8ae9Lz4qKYqoyofDaaY0Nw=='
const local_diferent_network = '9hsLRlznsMG9RuuzeQuVvA'
describe('/persistance/Cloud.js', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.me = '/+16282281824'
    vi.useFakeTimers()
    firebase.user = null
  })
  afterEach(() => {
    localStorage.me = undefined
    localStorage.clear()
  })
  // The application loads the data
  // The syncronizer deletes what's stale
  describe('Methods', () => {
    describe('#sync_offline_actions', () => {
      it('Needs to be online', async () => {
        expect(get).not.toBeCalled()
        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        await sync_offline_actions()
        expect(get).not.toBeCalled()
      })
      it('Handles a lack of offline content gracefylly', async () => {
        get.mockImplementationOnce(() => Promise.resolve(undefined))
        await sync_offline_actions()
        expect(del).not.toBeCalled()
      })
      it('Saves offline content', async () => {
        firebase.user = user
        const spy = vi.spyOn(Offline.prototype, 'save')
        get.mockImplementation(() =>
          Promise.resolve([
            { action: 'save', id: '/+6282281824/posters/1555347888' }
          ])
        )
        await sync_offline_actions()
        expect(get).toBeCalled()
        expect(spy).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Deletes offline content', async () => {
        firebase.user = user
        const spy = vi.spyOn(Offline.prototype, 'delete')
        get.mockImplementation(() =>
          Promise.resolve([
            { action: 'delete', id: '/+6282281824/posters/1555347888' }
          ])
        )
        await sync_offline_actions()
        expect(get).toBeCalled()
        expect(spy).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Logs info when an action is unclear', async () => {
        firebase.user = user
        get.mockImplementation(() =>
          Promise.resolve([
            { action: 'weirdo', id: '/+6282281824/posters/1555347888' }
          ])
        )
        await sync_offline_actions()
        expect(console.info).toBeCalled()
      })
    })
    describe('#prune', () => {
      const id = '/+16282281824'
      let relations
      let list_spy
      beforeEach(async () => {
        relations = [{ id }]
        firebase.user = user
        keys.mockImplementation(() =>
          Promise.resolve([id, 'random:key', '/+16781435566'])
        )
        const meta = {
          updated: new Date().toISOString(),
          customMetadata: { md5: local_diferent_network }
        }
        const index = {}
        index[id] = meta
        firebase.storage_mock.getMetadata.mockImplementation(() =>
          Promise.resolve(meta)
        )
        list_spy = vi.spyOn(itemid, 'list').mockImplementation(() => relations)
        get.mockImplementation(query => {
          if (query === 'sync:index') return index
          if (query === id) return Promise.resolve(person_html)
          return Promise.resolve()
        })
      })
      it('Gets all my relations', async () => {
        await prune()
        expect(keys).toBeCalled()
        expect(list_spy).toBeCalled()
      })
      it('Prunes items with outdated info', async () => {
        await prune()
        vi.runAllTimers()
        expect(keys).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Prunes people I am not following', async () => {
        const MockDate = require('mockdate')
        MockDate.set('2020-01-01')
        const index = {
          '/+16282281824': {
            updated: new Date().toISOString()
          }
        }
        MockDate.reset()
        get.mockImplementationOnce(query => {
          if (query === 'sync:index') return index
          return Promise.resolve(person_html)
        })
        await prune()
        expect(keys).toBeCalled()
      })
      it('Handles absence of custom metadata', async () => {
        del.mockClear()
        const bad_meta = {
          updated: new Date().toISOString()
        }
        firebase.storage_mock.getMetadata.mockImplementation(() =>
          Promise.resolve(bad_meta)
        )
        await prune()
        expect(del).not.toBeCalled()
      })
      it('Leaves properly synced local files alone', async () => {
        firebase.storage_mock.getMetadata.mockImplementation(() =>
          Promise.resolve({
            updated: new Date().toISOString(),
            customMetadata: { md5: local_matches_network }
          })
        )
        await prune()
        expect(del).not.toBeCalled()
      })
    })
    describe('#sync_later', () => {
      it('Stores local actions to be synced with the cloud', async () => {
        await sync_later('/+16282281824/posters/559666932867')
        expect(set).toBeCalled()
      })
    })
    describe('#visit_interval', () => {
      it('Returns a Date object', () => {
        expect(visit_interval()).not.toBe(null)
      })
    })
    describe('use', () => {
      describe('#auth_state_changed', () => {
        it('Connects sync worker to component', async () => {
          wrapper = await shallowMount(sync, fake_props)
          const play = vie
            .spyOn(wrapper.vm, 'play')
            .mockImplementation(() => Promise.resolve())
          await wrapper.vm.auth_state_changed({ phoneNumber: '+16282281824' })
          expect(play).toBeCalled()
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
          sync_offline_actions_sync = vi
            .spyOn(sync_worker, 'sync_offline_actions')
            .mockImplementation(() => Promise.resolve())
          sync_me = vi
            .spyOn(wrapper.vm, 'sync_me')
            .mockImplementation(() => Promise.resolve())
          sync_statements = vi
            .spyOn(wrapper.vm, 'sync_statements')
            .mockImplementation(() => Promise.resolve())
          sync_events = vi
            .spyOn(wrapper.vm, 'sync_events')
            .mockImplementation(() => Promise.resolve())
          sync_anonymous_posters = vi
            .spyOn(wrapper.vm, 'sync_anonymous_posters')
            .mockImplementation(() => Promise.resolve())
          sync_happened = vi
            .spyOn(wrapper.vm, 'sync_happened')
            .mockImplementation(() => Promise.resolve())
          firebase.user = current_user
          vi.spyOn(itemid, 'load').mockImplementation(() =>
            Promise.resolve({
              id: '/+16282281824'
            })
          )
        })
        it('Starts syncing without a last_sync', async () => {
          vi.useFakeTimers()
          await wrapper.vm.play()
          vi.runAllTimers()
          await flushPromises()
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(Statements.prototype, 'sync').mockImplementationOnce(() =>
            Promise.resolve([])
          )
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(Events.prototype, 'sync').mockImplementationOnce(() =>
            Promise.resolve([])
          )
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
          vi.spyOn(sync_worker, 'fresh_metadata').mockImplementation(() =>
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
            return Promise.resolve([])
          })
          await flushPromises()
          const save_poster_spy = vi
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
          vi.spyOn(itemid, 'load').mockImplementation(() =>
            Promise.resolve(person)
          )
          wrapper = await mount(sync, fake_props)
          expect(localStorage.sync_time).toBe(undefined)
          await wrapper.vm.sync_happened()
          await flushPromises()
          expect(localStorage.sync_time).not.toBe(undefined)
          expect(wrapper.emitted('update:person')).toBeTruthy()
        })
        it('Updates visit for the first time', async () => {
          person.visited = undefined
          vi.spyOn(itemid, 'load').mockImplementation(() =>
            Promise.resolve(person)
          )
          wrapper = await mount(sync, fake_props)
          expect(localStorage.sync_time).toBe(undefined)
          await wrapper.vm.sync_happened()
          await flushPromises()
          expect(localStorage.sync_time).not.toBe(undefined)
          expect(wrapper.emitted('update:person')).toBeTruthy()
        })
        it('Updates the visit once per hour', async () => {
          person.visited = new Date().toISOString()
          vi.spyOn(itemid, 'load').mockImplementation(() =>
            Promise.resolve(person)
          )
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
          const poster_save_spy = vi
            .spyOn(Poster.prototype, 'save')
            .mockImplementation(() => Promise.resolve())
          await wrapper.vm.save_poster(mock_poster)
          expect(del).toBeCalled()
          expect(poster_save_spy).toBeCalled()
        })
      })
    })
  })
  describe('Pruning the verge', () => {
    it.todo('Is mindfull of how large the local databese is getting')
  })
  describe('Peer syncing:', () => {
    it.todo('Contacts a signaling server to determine available peers')
    it.todo('Connects to available peer(s)')
    it.todo('Share indexes with peer')
    it.todo('Shares updates with peers')
    it.todo('User can choose to share activity with peer network')
    it.todo('User can choose to share relations with peer network')
    it.todo('User can share relations with their other devises')
  })
})

vi.spyOn(Statements.prototype, 'sync').mockImplementation(() =>
  Promise.resolve(statements)
)
vi.spyOn(Statements.prototype, 'save').mockImplementation(() =>
  Promise.resolve()
)
vi.spyOn(Events.prototype, 'sync').mockImplementation(() =>
  Promise.resolve(events)
)
vi.spyOn(Events.prototype, 'save').mockImplementation(() => Promise.resolve())
