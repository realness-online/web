import Item from '@/modules/Item'
import Storage, { posts_storage } from '@/persistance/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const hella_posts = fs.readFileSync('./tests/unit/html/hella_posts.html', 'utf8')

describe('@/persistance/Cloud.js', () => {
  afterEach(() => {
    localStorage.clear()
  })
  describe('#save', () => {
    it('Exists', () => {
      expect(posts_storage.save).toBeDefined()
    })
    it.todo('Saves items on the server', async () => {
      posts_storage.persist = jest.fn()
      await posts_storage.save(posts)
      await flushPromises()
      expect(posts_storage.persist).toBeCalled()
    })
  })
  describe('#get_download_url', () => {
    it('exists', () => {
      expect(posts_storage.get_download_url).toBeDefined()
    })
    it('Returns a url', async () => {
      const url = await posts_storage.get_download_url()
      expect(url).toBe('https://download_url/people/+16282281824/posts/index.html')
    })
    it('Returns null if person is not logged in', async () => {
      jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
        return { currentUser: null }
      })
      const url = await posts_storage.get_download_url()
      expect(url).toBe(null)
    })
  })
  describe('#persist', () => {
    let put_spy
    beforeEach(() => {
      put_spy = jest.fn(path => Promise.resolve(path))
      jest.spyOn(firebase, 'storage').mockImplementation(() => {
        return {
          ref: jest.fn(() => {
            return {
              child: jest.fn(path => {
                return {
                  put: put_spy
                }
              })
            }
          })
        }
      })
    })
    it('Exists', () => {
      expect(posts_storage.persist).toBeDefined()
    })
    it('Persist a file in a persons home directory', async () => {
      await posts_storage.persist(posts)
      await flushPromises()
      expect(put_spy).toBeCalled()
    })
    it('Does nothing unless user is signed in', async () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { currentUser: null }
      })
      await posts_storage.persist(posts)
      await flushPromises()
      expect(put_spy).not.toBeCalled()
    })
  })
})
