import * as sync from '@/workers/sync'
import { get, del, keys } from 'idb-keyval'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { Offline } from '@/persistance/Storage'
const fs = require('fs')
const offline_poster = fs.readFileSync('./tests/unit/html/poster-offline.html', 'utf8')
const user = { phoneNumber: '+16282281824' }

describe('/workers/sync.js', () => {
  beforeEach(() => {
    firebase.user = null
    jest.clearAllMocks()
  })
  // The application loads the data
  // the syncronizer deletes what's stale
  describe('methods', () => {
    describe('#message_listener', () => {
      it('Exists', () => {
        expect(sync.message_listener).toBeDefined()
      })
      it('Complains without an action', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
        sync.message_listener({
          data: {}
        })
        expect(spy).toBeCalled()
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
        it('sync:people', () => {
          get.mockImplementation(_ => Promise.resolve({ items: ['1555347888'] }))
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:people'
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
        it('sync:anonymous', () => {
          const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => null)
          sync.message_listener({
            data: {
              action: 'sync:anonymous'
            }
          })
          expect(spy).not.toBeCalled()
        })
      })
    })
    describe('#initialize', () => {
      it('Calls sync methods when online and signed in', async () => {
        firebase.user = user
        await sync.initialize({})
        expect(firebase.auth_mock.onAuthStateChanged).toBeCalled()
        firebase.user = null
      })
    })
    describe('#offline', () => {
      it('Needs to be signed in', async () => {
        await sync.offline()
        expect(get).not.toBeCalled()
      })
      it('Needs to be online', () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        sync.offline(user)
        expect(get).not.toBeCalled()
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
    describe('#anonymous', () => {
      it('Needs to be signed in', async () => {
        await sync.anonymous()
        expect(get).not.toBeCalled()
      })
      it('Needs to be online', () => {
        jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
        sync.anonymous(user)
        expect(get).not.toBeCalled()
      })
      it('handles no posters', async () => {
        await sync.anonymous(user)
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
        await sync.anonymous(user)
        expect(get).toHaveBeenCalledTimes(2)
        expect(del).toHaveBeenCalledTimes(2)
      })
    })
    describe('#people', () => {
      it('Needs to be signed in', () => {
        sync.people()
        expect(keys).not.toBeCalled()
      })
      it('Prunes people with outdated info', async () => {
        //  for failure ['/+1/posters/559666932867']
        const ids = ['/+16282281824']
        const index = {
          '/+16282281824': {
            updated: 'Oct 12, 2020, 10:54:24 AM'
          }
        }
        const meta = {
          updated: 'Oct 12, 2020, 10:54:24 AM'
        }
        keys.mockImplementationOnce(() => Promise.resolve(ids))
        get.mockImplementation(_ => Promise.resolve(index))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
        await sync.people(user)
        expect(keys).toBeCalled()
        expect(get).toBeCalled()
      })

      it('Can force a check to happen', async () => {
        const ids = ['/+16282281824']
        const index = {
          '/+16282281824': {
            updated: 'Oct 12, 2020, 10:54:24 AM'
          }
        }
        const meta = {
          updated: 'Oct 14, 2020, 10:54:24 AM'
        }
        keys.mockImplementationOnce(() => Promise.resolve(ids))
        get.mockImplementation(_ => Promise.resolve(index))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
        await sync.people(user, true)
      })

      it('Will check all of the persons files for updates', async () => {
        const ids = ['/+16282281824']
        const index = {
          '/+16282281824': {
            updated: 'Oct 12, 2020, 10:54:24 AM'
          },
          '/+16282281824/statements': {
            updated: 'Oct 18, 2020, 10:54:24 AM'
          },
          '/+16282281824/events': {
            updated: 'Oct 22, 2020, 10:54:24 AM'
          }
        }
        const meta = {
          updated: 'Oct 28, 2020, 10:54:24 AM'
        }
        keys.mockImplementationOnce(() => Promise.resolve(ids))
        get.mockImplementation(_ => Promise.resolve(index))
        firebase.storage_mock.getMetadata.mockImplementation(_ => Promise.resolve(meta))
        await sync.people(user, true)
      })
    })
  })
  describe('Pruning the verge', () => {
    it.todo('App is mindfull of how large the local databese is getting')
    it.todo('Removes posters that are no longer in the directory')
    it.todo('Ocasionally prunes people I am not following (from local feed)')
    it.todo('Ocasionally prunes people I am following who haven\'t posted in a while (dead accounts)')
  })
  describe('Peer syncing:', () => {
    it.todo('Connects to available peer')
    it.todo('Share indexes with peer')
    it.todo('Shares updates with peers')
    it.todo('User can choose to share activity with peer network')
    it.todo('User can choose to share relations with peer network')
    it.todo('User can share relations with their other devises for a few minutes')
    it.todo('Contacts a signaling server to determine available peers')
  })
})
