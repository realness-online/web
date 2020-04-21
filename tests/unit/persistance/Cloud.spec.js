import Storage from '@/persistance/Storage'
import Cloud from '@/persistance/Cloud'
import Local from '@/persistance/Local'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
import { del } from 'idb-keyval'
describe ('@/persistance/Cloud.js', () => {
  class Preferences extends Cloud(Storage) {}
  let cloud
  beforeEach(() => {
    cloud = new Preferences("/+16282281824/preferences")
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe ('#save', () => {
    it ('Exists', () => {
      expect(cloud.save).toBeDefined()
    })
    it('Only saves if their are items', async() => {
      cloud.to_network = jest.fn()
      await cloud.save()
      expect(cloud.to_network).not.toBeCalled()
    })
    it('Only saves certain types', async () => {
      cloud.to_network = jest.fn()
      await cloud.save(posts)
      expect(cloud.to_network).not.toBeCalled()
    })
    it('Saves items on the server', async () => {
      cloud.to_network = jest.fn()
      cloud.type = 'avatars'
      await cloud.save(posts)
      expect(cloud.to_network).toBeCalled()
    })
    it('calls save on a parent class', async () => {
      class Whatever extends Cloud(Local(Storage)) {}
      cloud = new Whatever()
      cloud.to_network = jest.fn()
      cloud.type = 'avatars'
      await cloud.save(posts)
      expect(cloud.to_network).toBeCalled()
    })
  })
  describe ('#delete', () => {
    it('Deletes a resource on the cloud', async () => {
      await cloud.delete()
      expect(del).toBeCalled()
      expect(firebase.storage().ref().child().delete).toBeCalled()
    })
    it('Only deletes when logged in', async () => {
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
        return { currentUser: null }
      })
      await cloud.delete()
      expect(del).not.toBeCalled()
      expect(firebase.storage().ref().child().delete).not.toBeCalled()
    })
  })
  describe ('#to_network', () => {
    it ('Exists', () => {
      expect(cloud.to_network).toBeDefined()
    })
    it ('Persist a file in a persons home directory', async () => {
      await cloud.to_network(posts)
      expect(firebase.storage().ref().child().put).toBeCalled()
    })
    it ('Does nothing unless user is signed in', async () => {
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
        return { currentUser: null }
      })
      await cloud.to_network(posts)
      expect(firebase.storage().ref().child().put).not.toBeCalled()
    })
  })
  })
