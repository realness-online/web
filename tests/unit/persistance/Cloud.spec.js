import { posts_storage } from '@/persistance/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')

describe ('@/persistance/Cloud.js', () => {
  afterEach(() => {
    localStorage.clear()
  })
  describe ('#save', () => {
    it ('Exists', () => {
      expect(posts_storage.save).toBeDefined()
    })
    it.skip('Saves items on the server', async () => {
      posts_storage.to_network = jest.fn()
      await posts_storage.save(posts)
      await flushPromises()
      expect(posts_storage.to_network).toBeCalled()
    })
  })
  describe ('#to_network', () => {
    it ('Exists', () => {
      expect(posts_storage.to_network).toBeDefined()
    })
    it ('Persist a file in a persons home directory', async () => {
      await posts_storage.to_network(posts)
      await flushPromises()
      expect(firebase.storage().child().put).toBeCalled()
    })
    it ('Does nothing unless user is signed in', async () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { currentUser: null }
      })
      await posts_storage.to_network(posts)
      await flushPromises()
      expect(firebase.storage().child().put).not.toBeCalled()
    })
  })
})
