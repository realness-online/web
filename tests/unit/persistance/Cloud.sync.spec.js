import { get, del, keys, set } from 'idb-keyval'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { Offline } from '@/persistance/Storage'
import {
  prune,
  sync_offline_actions,
  sync_later,
  visit_interval
} from '@/persistance/Cloud.sync'
import * as itemid from '@/use/itemid'
const person_html = require('fs').readFileSync(
  './tests/unit/html/person.html',
  'utf8'
)
const user = { phoneNumber: '+16282281824' }
const local_matches_network = '8ae9Lz4qKYqoyofDaaY0Nw=='
const local_diferent_network = '9hsLRlznsMG9RuuzeQuVvA'
describe('/persistance/Cloud.js', () => {
  beforeEach(async () => {
    localStorage.me = '/+16282281824'
    jest.useFakeTimers()
    firebase.user = null
  })
  afterEach(() => {
    jest.clearAllMocks()
    get.mockClear()
    localStorage.clear()
  })
  // The application loads the data
  // The syncronizer deletes what's stale
  describe('Methods', () => {
    describe('#sync_offline_actions', () => {
      it('Needs to be online', async () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        await sync_offline_actions()
        expect(get).not.toBeCalled()
      })
      it('Handles a lack of offline content gracefylly', async () => {
        get.mockImplementation(() => Promise.resolve(undefined))
        await sync_offline_actions()
        expect(del).not.toBeCalled()
      })
      it('Saves offline content', async () => {
        firebase.user = user
        const spy = jest.spyOn(Offline.prototype, 'save')
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
        const spy = jest.spyOn(Offline.prototype, 'delete')
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
        list_spy = jest
          .spyOn(itemid, 'list')
          .mockImplementation(() => relations)
        get.mockImplementation(query => {
          if (query === 'sync:index') return index
          if (query === id) return Promise.resolve(person_html)
          else return Promise.resolve()
        })
      })
      it('Gets all my relations', async () => {
        await prune()
        expect(keys).toBeCalled()
        expect(list_spy).toBeCalled()
      })
      it('Prunes items with outdated info', async () => {
        await prune()
        jest.runAllTimers()
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
          else return Promise.resolve(person_html)
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
    it.todo(
      'User can share relations with their other devises for a few minutes'
    )
  })
})
