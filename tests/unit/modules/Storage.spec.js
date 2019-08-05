import Item from '@/modules/Item'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const hella_posts = fs.readFileSync('./tests/unit/html/hella_posts.html', 'utf8')
describe('@/modules/Storage.js', () => {
  afterEach(() => {
    localStorage.clear()
  })
  describe('Retrieving', () => {
    let storage
    let item_as_string
    beforeEach(() => {
      item_as_string = `
      <section itemscope itemtype="/person">
        <h1 itemprop="name">Scott Fryxell</h1>
      </section>`
      document.body.innerHTML = item_as_string
      storage = new Storage('person')
    })
    describe('#hydrate', () => {
      it('Exists', () => {
        expect(Storage.hydrate).toBeDefined()
      })
      it('Will create an html fragment from a string', () => {
        storage = Storage.hydrate(item_as_string)
        expect(storage.querySelectorAll('h1').length).toBe(1)
      })
    })
    describe('#from_storage', () => {
      beforeEach(() => {
        localStorage.setItem(storage.name, item_as_string)
      })
      it('Exists', () => {
        expect(storage.from_storage).toBeDefined()
      })
      it('Loads an item from local storage', async() => {
        const items = await storage.from_storage()
        expect(items).not.toBe(null)
        expect(items.querySelectorAll('h1').length).toBe(1)
        expect(items.querySelectorAll('[itemprop="name"]').length).toBe(1)
      })
    })
    describe('#as_list', () => {
      beforeEach(() => {
        localStorage.setItem(storage.name, item_as_string)
      })
      it('Exists', () => {
        expect(storage.as_list).toBeDefined()
      })
      it('Creates list of objects', async() => {
        const list = await storage.as_list()
        expect(list.length).toBe(1)
      })
    })
    describe('#as_object', () => {
      it('Exists', () => {
        expect(storage.as_object).toBeDefined()
      })
      it('Will return the first item it finds', async() => {
        localStorage.setItem(storage.name, item_as_string)
        const scott = await storage.as_object()
        expect(scott.name).toBe('Scott Fryxell')
      })
    })
    describe('#get_download_url', () => {
      it('exists', () => {
        expect(storage.get_download_url).toBeDefined()
      })
      it('Returns a url', async() => {
        const url = await storage.get_download_url()
        expect(url).toBe('https://download_url/people/+16282281824/person.html')
      })
      it('Returns null if person is not logged in', async() => {
        jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
          return { currentUser: null }
        })
        const url = await storage.get_download_url()
        expect(url).toBe(null)
      })
    })
    describe('#sync_list', () => {
      let posts_storage
      beforeEach(() => {
        posts_storage = new Storage('posts', '[itemprop=posts]')
      })
      it('Exists', () => {
        expect(posts_storage.sync_list).toBeDefined()
      })
      it('Syncs posts from server to local storage', async() => {
        localStorage.setItem('posts', hella_posts)
        fetch.mockResponseOnce(posts)

        // five posts on the server one that overlaps
        const server_list = Item.get_items(Storage.hydrate(posts))
        expect(server_list.length).toBe(6)

        // 54 posts on the client one that overlaps
        const local_list = Item.get_items(posts_storage.from_local())
        expect(local_list.length).toBe(79)

        // 58 posts when synced
        const list = await posts_storage.sync_list()
        expect(list.length).toBe(85)
      })
    })
  })
  describe('Persistance', () => {
    let posts_storage
    beforeEach(() => {
      posts_storage = new Storage('posts', '[itemprop=posts]')
    })
    describe('#optimize', () => {
      it('Exists', () => {
        expect(posts_storage.optimize).toBeDefined()
      })
      it('It optimizes a list of items accross a set of pages', async() => {
        localStorage.setItem(posts_storage.name, hella_posts)
        await posts_storage.optimize()
        expect(Object.keys(localStorage.__STORE__).length).toBe(3)
      })
    })
    describe('#save', () => {
      it('Exists', () => {
        expect(posts_storage.save).toBeDefined()
      })
      it('Saves items locally and on the server', async() => {
        posts_storage.persist = jest.fn()
        await posts_storage.save(posts)
        await flushPromises()
        expect(localStorage.setItem).toBeCalled()
        expect(posts_storage.persist).toBeCalled()
      })
    })
    describe('#persist', () => {
      it('Exists', () => {
        expect(posts_storage.persist).toBeDefined()
      })
      it('Persist a file in a persons home directory', async() => {
        const url = await posts_storage.persist(posts)
        expect(url).toBe('/people/+16282281824/posts.html')
      })
      it('Does nothing unless user is signed in', async() => {
        jest.spyOn(firebase, 'auth').mockImplementation(() => {
          return { currentUser: null }
        })
        const url = await posts_storage.persist(posts)
        expect(url).toBe('offline')
      })
    })
  })
})
