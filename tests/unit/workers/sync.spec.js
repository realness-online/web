// import * as sync from '@/workers/sync'
import { get, del, keys } from 'idb-keyval'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
import { Offline } from '@/persistance/Storage'
const offline_poster = require('fs').readFileSync('./tests/unit/html/poster-offline.html', 'utf8')
const person_html = require('fs').readFileSync('./tests/unit/html/person.html', 'utf8')
const user = { phoneNumber: '+16282281824' }

describe('/workers/sync.js', () => {
  let post_message_spy
  let sync
  beforeEach(async () => {
    post_message_spy = jest.spyOn(global, 'postMessage').mockImplementation(_ => true)
    jest.useFakeTimers()
    firebase.user = null
    sync = await import('@/workers/sync')
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  // The application loads the data
  // the syncronizer deletes what's stale
  describe('Methods', () => {
    describe('#message_listener', () => {
      it('Exists', () => {
        expect(sync.message_listener).toBeDefined()
      })
      describe('Actions', () => {
        it('sync:initialize', () => {
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:initialize',
              env: {}
            }
          })
          expect(spy).not.toBeCalled()
        })
        it('sync:offline', () => {
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:offline'
            }
          })
          expect(spy).not.toBeCalled()
        })
        it('sync:play', () => {
          get.mockImplementation(_ => Promise.resolve({ items: ['1555347888'] }))
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:play'
            }
          })
          expect(spy).not.toBeCalled()
        })
        it('sync:pause', () => {
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:pause'
            }
          })
          expect(spy).not.toBeCalled()
        })
      })
    })
    describe('#initialize', () => {
      it('Initializes one instance of firebase', async () => {
        firebase.apps.push('new_app')
        firebase.user = user
        await sync.initialize({})
        expect(firebase.initializeApp).not.toBeCalled()
        firebase.user = null
        firebase.apps.pop()
      })
      it('Calls sync methods when online and signed in', async () => {
        firebase.user = user
        await sync.initialize({})
        expect(firebase.initializeApp).toBeCalled()
        firebase.user = null
      })
    })
    describe('#offline', () => {
      it('Needs to be online', () => {
        get.mockRestore()
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        sync.offline()
        expect(get).not.toBeCalled()
      })
      it('Handles a lack of offline content gracefylly', async () => {
        get.mockImplementation(_ => Promise.resolve(undefined))
        await sync.offline()
        expect(del).not.toBeCalled()
      })
      it('Saves offline content', async () => {
        firebase.user = user
        const spy = jest.spyOn(Offline.prototype, 'save')
        get.mockImplementation(_ => Promise.resolve([
          { action: 'save', id: '/+6282281824/posters/1555347888' }
        ]))
        await sync.offline()
        expect(get).toBeCalled()
        expect(spy).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Deletes offline content', async () => {
        firebase.user = user
        const spy = jest.spyOn(Offline.prototype, 'delete')
        get.mockImplementation(_ => Promise.resolve([
          { action: 'delete', id: '/+6282281824/posters/1555347888' }
        ]))
        await sync.offline()
        expect(get).toBeCalled()
        expect(spy).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Logs info when an action is unclear', async () => {
        firebase.user = user
        get.mockImplementation(_ => Promise.resolve([
          { action: 'weirdo', id: '/+6282281824/posters/1555347888' }
        ]))
        await sync.offline()
        expect(console.info).toBeCalled()
      })
    })
    describe('#anonymous_posters', () => {
      it('Needs to be signed in', async () => {
        await sync.anonymous_posters()
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
    describe('#people', () => {
      const id = '/+16282281824'
      let relations
      let random
      afterEach(() => {
        Math.random = random
      })
      beforeEach(async () => {
        random = Math.random
        Math.random = jest.fn(_ => 1)
        relations = [{ id }]
        firebase.user = user
        keys.mockImplementation(_ => Promise.resolve([id]))
        const meta = {
          updated: new Date().toISOString(),
          customMetadata: { md5: '9hsLRlznsMG9RuuzeQuVvA==' }
        }
        const index = {}
        index[id] = meta
        get.mockImplementation(query => {
          if (query === 'sync:index') return index
          if (query === id) return Promise.resolve(person_html)
          else return Promise.resolve()
        })
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
      })
      it('Runs when online', async () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        await sync.people()
        expect(get).not.toBeCalled()
      })
      it('Prunes people with outdated info', async () => {
        await sync.people(relations)
        await flushPromises()
        jest.runAllTimers()
        expect(get).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Ignores people who are no longer using the sercvice', async () => {
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
          else return Promise.resolve(person_html)
        })
        await sync.people(relations)
        jest.runAllTimers()
        expect(get).toBeCalled()
      })
      it('Randomly checks on a stale person', async () => {
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
          else return Promise.resolve(person_html)
        })

        Math.random = jest.fn(_ => 0)
        await sync.people(relations)
        jest.runAllTimers()
        expect(get).toBeCalled()
        Math.random = random
      })
      it('Checks on a recent users children for a reasonable interval', async () => {
        const updated = new Date()
        updated.setMinutes(updated.getMinutes() - 55)
        const meta = {
          updated,
          customMetadata: { md5: '8ae9Lz4qKYqoyofDaaY0Nw==' }
        }
        const index = {}
        index[id] = meta
        get.mockImplementationOnce(query => {
          if (query === 'sync:index') return index
          if (query === id) return Promise.resolve(person_html)
          else return Promise.resolve()
        })
        firebase.storage_mock.getMetadata.mockImplementationOnce(_ => Promise.resolve(meta))
        await sync.people(relations)
        await flushPromises()
        jest.runAllTimers()
        expect(get).toBeCalled()
        expect(del).toHaveBeenCalledTimes(3)
      })
    })
    describe('#sync', () => {
      it('Fails gracefully when offline', async () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        await sync.sync()
        expect(post_message_spy).not.toBeCalled()
      })
      it('Fails gracefully when user is signed out', async () => {
        firebase.user = null
        await sync.sync()
        expect(post_message_spy).not.toBeCalled()
      })
      it('Runs when user is signed in', async () => {
        const meta = { updated: 'Oct 13, 2020, 12:00:00 PM' }
        const updated = 'Oct 12, 2020, 10:54:24 AM'
        const index = {
          '/+16282281824': { updated },
          '/+16282281824/statements': { updated },
          '/+16282281824/events': { updated }
        }
        get.mockImplementation(id => {
          if (id === 'sync:index') return Promise.resolve(index)
          else return Promise.resolve(null)
        })
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
        firebase.user = user
        await sync.sync()
        await flushPromises()
        expect(post_message_spy).toHaveBeenCalledTimes(3)
      })
      it('Works without an existing index', async () => {
        jest.clearAllMocks()
        const meta = { updated: 'Oct 13, 2020, 12:00:00 PM' }
        get.mockImplementation(_ => Promise.resolve(undefined))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
        firebase.user = user
        await sync.sync()
        await flushPromises()
        expect(post_message_spy).toHaveBeenCalledTimes(3)
      })
      it('Runs statments checks if user is outdated', async () => {
        const updated = 'Oct 12, 2020, 10:54:24 AM'
        const index = {
          '/+16282281824': { updated },
          '/+16282281824/statements': { updated }
        }
        get.mockImplementation(_ => Promise.resolve(index))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve({ updated }))
        firebase.user = user
        await sync.sync()
        await flushPromises()
        expect(post_message_spy).toHaveBeenCalledTimes(3)
      })
      it('Tells the app to sync statements apropriatly', async () => {
        const updated = 'Oct 12, 2020, 10:54:24 AM'
        const outdated = 'Oct 11, 2020, 10:54:24 AM'
        const index = {
          '/+16282281824': { updated: outdated },
          '/+16282281824/statements': { updated: outdated },
          '/+16282281824/events': { updated }
        }
        get.mockImplementation(_ => Promise.resolve(index))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve({ updated }))
        firebase.user = user
        await sync.sync()
        await flushPromises()
        expect(post_message_spy).toHaveBeenCalledTimes(3)
      })
    })
    describe('#play', () => {
      it('Starts syncing without a last_sync', async () => {
        firebase.user = user
        await sync.play()
        expect(post_message_spy).toHaveBeenCalledTimes(3)
      })
      it('Sets a timer for the remaining time until sync', async () => {
        firebase.user = user
        await sync.play({ last_sync: new Date().toISOString() })
        expect(post_message_spy).not.toBeCalled()
      })
    })
    describe('#prune_strangers', () => {
      it('removes people I am not follwing from the local db', () => {
        const id = '/+16282281824'
        firebase.user = user
        const relations = [{ id }]
        keys.mockImplementation(_ => Promise.resolve([
          id,
          '/+14153721982/posters/12338658w498',
          '/+14153721982'
        ]))
        // When viewing hte phone book you will downloadthe list of available users
        sync.prune_strangers(relations)
      })
    })
  })
  describe('Pruning the verge', () => {
    it.todo('Is mindfull of how large the local databese is getting')
    it.todo('Cleans up old posters')
    it.todo('Prunes people I am no longer following')
  })
  describe('Peer syncing:', () => {
    it.todo('Contacts a signaling server to determine available peers')
    it.todo('Connects to available peer(s)')
    it.todo('Share indexes with peer')
    it.todo('Shares updates with peers')
    it.todo('User can choose to share activity with peer network')
    it.todo('User can choose to share relations with peer network')
    it.todo('User can share relations with their other devises for a few minutes')
  })
})
