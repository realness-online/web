import * as sync from '@/workers/sync'
describe('/workers/sync.js', () => {
  // The application loads the data
  // the syncronizer deletes what's stale
  it('syncronize exists', async () => {
    await sync.syncronize({ phoneNumber: '+16282281824' })
    expect(sync.syncronize).toBeDefined()
  })
  describe('Syncronzing IndexDB:', () => {
      it.todo('gets a list of all the people I am interested in and the last time they logged in')
      it.todo('Syncs posters created while signed in but offline')
      it.todo('Syncs directories')
      it.todo('Keeps track of how old items are')
      it.todo('Checks if a resourse has been updated')
      it.todo('Removes any items that are no longer in sync with what is current')
    })
    describe('Frequency:', () => {
      it.todo('Checks every 5 minutes for updates from users who have posted recently')
      it.todo('Check once per session for people who haven\'t posted in a while')
      it.todo('Will rely on peer to peer for updates sooner than five minutes')
    })
    describe('Peer syncing:', () => {
      it.todo('Contacts a signaling server to determine available peers')
      it.todo('Connects to available peer')
      it.todo('Share indexes with peer')
      it.todo('Shares updates with peers')
    })
  })
