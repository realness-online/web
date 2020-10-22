import * as sync from '@/workers/sync'
import { get, set, del } from 'idb-keyval'
const fs = require('fs')
const offline_poster = fs.readFileSync('./tests/unit/html/poster-offline.html', 'utf8')
describe('/workers/sync.js', () => {
  // The application loads the data
  // the syncronizer deletes what's stale
  it('syncronize exists', async () => {
    await sync.syncronize({ phoneNumber: '+16282281824' })
    expect(sync.syncronize).toBeDefined()
  })
  describe('Syncronzing IndexDB:', () => {
    it.todo('uses firebase to determine the last time a person signed in')
    describe('Large', () => {
      it('Checks for anonymous posters', async () => {
        await sync.sync_anonymous_posters()
        expect(get).toBeCalled()
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
        expect(get).toHaveBeenCalledTimes(0)
        await sync.sync_anonymous_posters()
        expect(get).toHaveBeenCalledTimes(3)
        expect(del).toBeCalled()
        expect(set).toBeCalled()
      })
    })
    it.todo('Syncs posters created while signed in but offline')
    it.todo('gets a list of my relations')
    it.todo('knows when each of my relations last logged in')
    it.todo('Deletes recent users posters directories')
    it.todo('Keeps track of how old items are')
    it.todo('Checks if a resourse has been updated')
    it.todo('Removes any items that are no longer in sync with what is current')
  })
  // these are all post release
  describe('Frequency:', () => {
    it.todo('Checks every 5 minutes for updates from users who have posted recently')
    it.todo('Will rely on peer to peer for updates sooner than five minutes')
  })
  describe('Pruning the verge', () => {
    it.todo('App is mindfull of how large the local databese is getting')
    it.todo('Removes posters that are no longer in the directory')
    it.todo('Ocasionally prunes people I am not following (from local feed)')
    it.todo('Ocasionally prunes people I am following who haven\'t posted in a while (dead accounts)')
    it.todo('Deletes older posters and user history to guarantee database tolerances')
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
