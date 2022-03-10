import Storage from '@/persistance/Storage'
import Cloud from '@/persistance/Cloud'
import Local from '@/persistance/Local'
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { get } from 'idb-keyval'
import { flushPromises } from '@vue/test-utils'
const statements = {
  outerHTML: require('fs').readFileSync(
    './tests/unit/html/statements.html',
    'utf8'
  )
}
const user = { phoneNumber: '/+16282281824' }
describe('@/persistance/Cloud.js', () => {
  class Preferences extends Cloud(Storage) {}
  let cloud
  beforeEach(() => {
    cloud = new Preferences('/+16282281824/preferences')
  })
  afterEach(() => {
    firebase.user = null
    vi.clearAllMocks()
    vi.restoreAllMocks()
    // vi.resetAllMocks()
    localStorage.clear()
  })
  describe('Methods', () => {
    describe('#save', () => {
      it('Exists', () => {
        expect(cloud.save).toBeDefined()
      })
      it('Only saves if their are items', async () => {
        cloud.to_network = vi.fn()
        await cloud.save()
        expect(cloud.to_network).not.toBeCalled()
      })
      it('Only saves certain types', async () => {
        cloud.to_network = vi.fn()
        await cloud.save(statements)
        expect(cloud.to_network).not.toBeCalled()
      })
      it('Saves items on the server', async () => {
        cloud.to_network = vi.fn()
        cloud.type = 'avatars'
        await cloud.save(statements)
        expect(cloud.to_network).toBeCalled()
      })
      it('Calls save on a parent class', async () => {
        class Whatever extends Cloud(Local(Storage)) {}
        cloud = new Whatever('/+16282281824/whatevers')
        cloud.to_network = vi.fn()
        cloud.type = 'avatars'
        await cloud.save(statements)
        expect(cloud.to_network).toBeCalled()
      })
    })
    describe('#delete', () => {
      it('Deletes a resource on the cloud', async () => {
        firebase.user = user
        await cloud.delete()
        await flushPromises()
        expect(firebase.storage().ref().child().delete).toBeCalled()
      })
      it('Only deletes when logged in', async () => {
        firebase.user = null
        get.mockImplementation(() => Promise.resolve([]))
        await cloud.delete()
        await flushPromises()
        expect(firebase.storage().ref().child().delete).not.toBeCalled()
      })
    })
    describe('#to_network', () => {
      it('firebase.user = userxists', () => {
        expect(cloud.to_network).toBeDefined()
      })
      it('Persist a file in a persons home directory', async () => {
        firebase.user = user
        await cloud.to_network(statements)
        expect(firebase.storage().ref().child().putString).toBeCalled()
        firebase.user = null
      })
      it('Does nothing unless user is signed in', async () => {
        await cloud.to_network(statements)
        expect(firebase.storage().ref().child().putString).not.toBeCalled()
      })
    })
  })
})
