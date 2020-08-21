import { shallow } from 'vue-test-utils'
import sync from '@/components/sync'
describe('@/components/sync', () => {
  it('Renders sync component', () => {
    const wrapper = shallow(sync)
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  describe('Syncronzing localstorage', () => {
    it.todo('Only checks local storage for current user')
    it.todo('Syncronizes and deletes anonymous content once per session')
    describe('Syncronizing models', () => {
      it.todo('Statements')
      it.todo('Profile')
      it.todo('Events')
      it.todo('Posters')
    })
  })
  describe('Sync worker', () => {
    describe('Syncronzing IndexDB:', () => {
      // The application loads the data
      // the syncronizer deletes what's stale
      it.todo('Relies on itemid to load and add to cache')
      it.todo('Keeps track of how old items are')
      it.todo('Checks if a resourse has been updated')
      it.todo('Removes any items that are no longer in sync with what\'s current')
    })
    describe('Frequency:', () => {
      it.todo('will rely on peer to peer for updates sooner than five minutes')
      it.todo('Checks every 5 minutes for updates from users who have posted recently')
      it.todo('Check once per session for people who haven\'t posted in a while')
    })
    describe('Peer syncing:', () => {
      it.todo('contacts with a signaling server to determine available peers')
      it.todo('Connects to available peer')
      it.todo('share indexes with peer')
      it.todo('shares updates with peers')
    })
  })
})
