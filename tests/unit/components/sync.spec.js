import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'
import sync from '@/components/sync'
import * as firebase from 'firebase/app'
import 'firebase/auth'
describe('@/components/sync', () => {
  let wrapper
  const currentUser = {
    phoneNumber: '+16282281824'
  }
  beforeEach(async () => {
    const onAuthStateChanged = jest.fn(state_changed => {
      state_changed(currentUser)
    })
    jest.spyOn(firebase, 'auth').mockImplementation(_ => {
      return { onAuthStateChanged }
    })
    localStorage.me = `/${currentUser}`
    get.mockImplementation(_ => Promise.resolve([]))
    set.mockImplementation(_ => Promise.resolve(null))
    wrapper = shallow(sync)
    await flushPromises()
  })
  it('Renders sync component', async () => {
    expect(wrapper.element).toMatchSnapshot()
    wrapper.destroy()
  })
  it('Terminates worker on destroy', async () => {
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
      it.todo('Keeps track of how old items are')
      it.todo('Checks if a resourse has been updated')
      it.todo('Removes any items that are no longer in sync with what\'s current')
    })
    describe('Frequency:', () => {
      it.todo('Checks every 5 minutes for updates from users who have posted recently')
      it.todo('Check once per session for people who haven\'t posted in a while')
      it.todo('will rely on peer to peer for updates sooner than five minutes')
    })
    describe('Peer syncing:', () => {
      it.todo('contacts a signaling server to determine available peers')
      it.todo('Connects to available peer')
      it.todo('share indexes with peer')
      it.todo('shares updates with peers')
    })
  })
})
