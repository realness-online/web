import { get, del, keys } from 'idb-keyval'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
import { Offline } from '@/persistance/Storage'
import { prune, sync, sync_offline_actions } from '@/persistance/Sync'
const person_html = require('fs').readFileSync('./tests/unit/html/person.html', 'utf8')
const user = { phoneNumber: '+16282281824' }

describe('/persistance/Cloud.js', () => {
  let post_message_spy
  beforeEach(async () => {
    post_message_spy = jest.spyOn(global, 'postMessage').mockImplementation(_ => true)
    jest.useFakeTimers()
    firebase.user = null
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  // The application loads the data
  // The syncronizer deletes what's stale
  describe('Methods', () => {
    describe('#sync_offline_actions', () => {
      it('Needs to be online', async () => {
        get.mockRestore()
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        await sync_offline_actions()
        expect(get).not.toBeCalled()
      })
      it('Handles a lack of offline content gracefylly', async () => {
        get.mockImplementation(_ => Promise.resolve(undefined))
        await sync_offline_actions()
        expect(del).not.toBeCalled()
      })
      it('Saves offline content', async () => {
        firebase.user = user
        const spy = jest.spyOn(Offline.prototype, 'save')
        get.mockImplementation(_ => Promise.resolve([
          { action: 'save', id: '/+6282281824/posters/1555347888' }
        ]))
        await sync_offline_actions()
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
        await sync_offline_actions()
        expect(get).toBeCalled()
        expect(spy).toBeCalled()
        expect(del).toBeCalled()
      })
      it('Logs info when an action is unclear', async () => {
        firebase.user = user
        get.mockImplementation(_ => Promise.resolve([
          { action: 'weirdo', id: '/+6282281824/posters/1555347888' }
        ]))
        await sync_offline_actions()
        expect(console.info).toBeCalled()
      })
    })
    describe('#prune', () => {
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
        await prune()
        expect(get).not.toBeCalled()
      })
      it('Prunes items with outdated info', async () => {
        await prune()
        await flushPromises()
        jest.runAllTimers()
        expect(keys).toBeCalled()
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
        await prune()
        jest.runAllTimers()
        expect(keys).toBeCalled()
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
    it.todo('User can share relations with their other devises for a few minutes')
  })
})
