import Item from '@/modules/Item'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
import growth from '@/modules/growth'
const fs = require('fs')
const posts = fs.readFileSync('./tests/unit/html/posts.html', 'utf8')
const server_text = fs.readFileSync('./tests/unit/html/other_posts.html', 'utf8')
const too_big_in_bytes = growth.first() * 1024

describe('@/modules/Storage.js', () => {
  let storage
  afterEach(() => {
    localStorage.clear()
  })
  describe('retrieving', () => {
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
      it('exists', () => {
        expect(Storage.hydrate).toBeDefined()
      })
      it('will create an html fragment from a string', () => {
        storage = Storage.hydrate(item_as_string)
        expect(storage.querySelectorAll('h1').length).toBe(1)
      })
    })
    describe('#from_storage', () => {
      beforeEach(() => {
        localStorage.setItem(storage.name, item_as_string)
      })
      it.only('exists', () => {
        expect(storage.from_storage).toBeDefined()
      })
      it('loads an item from local storage', async() => {
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
      it('exists', () => {
        expect(storage.as_list).toBeDefined()
      })
      it('creates list of objects', async() => {
        const list = await storage.as_list()
        expect(list.length).toBe(1)
      })
    })
    describe('#as_object', () => {
      it('exists', () => {
        expect(storage.as_object).toBeDefined()
      })
      it('will return the first item it finds', async() => {
        localStorage.setItem(storage.name, item_as_string)
        const scott = await storage.as_object()
        expect(scott.name).toBe('Scott Fryxell')
      })
    })
    describe('#get_download_url', () => {
      it('exists', () => {
        expect(storage.get_download_url).toBeDefined()
      })
      it('resolves a promise with a download url', async() => {
        const url = await storage.get_download_url()
        expect(url).toBe('https://download_url/people/+16282281824/person.html')
      })
      it('rejects a promise if user is not logged in', async() => {
        jest.spyOn(firebase, 'auth').mockImplementation(() => {
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
      it('exists', () => {
        expect(posts_storage.sync_list).toBeDefined()
      })
      it.only('syncs posts from server to local storage', async() => {
        fetch.mockResponseOnce(server_text)
        localStorage.setItem('posts', posts)

        // five posts on the server one that overlaps
        const server_list = Item.get_items(Storage.hydrate(server_text))
        expect(server_list.length).toBe(5)

        // 54 posts on the clien one that overlaps
        const local_list = Item.get_items(posts_storage.from_local())
        expect(local_list.length).toBe(54)

        // 58 posts when synced
        const list = await posts_storage.sync_list()
        expect(list.length).toBe(58)
      })
    })
  })
  describe('persistance', () => {
    let posts, posts_storage
    beforeEach(() => {

      posts_storage = new Storage('posts', '[itemprop=posts]')
    })
    describe('#optimize', () => {
      it('exists', () => {
        expect(posts_storage.optimize).toBeDefined()
      })
      it('it optimizes a user list accross a set of pages', async() => {
        localStorage.setItem(posts_storage.name, posts)
        await posts_storage.optimize()
        expect(Object.keys(localStorage.__STORE__).length).toBe(3)
      })
    }),
    describe('#save', () => {
      it('exists', () => {
        expect(posts_storage.save).toBeDefined()
      })
      it('saves items to locally and on the server', async() => {
        posts_storage.persist = jest.fn()
        await posts_storage.save(posts)
        await flushPromises()
        expect(localStorage.setItem).toBeCalled()
        expect(posts_storage.persist).toBeCalled()
      })
    })
    describe('#persist', () => {
      it('exists', () => {
        expect(posts_storage.persist).toBeDefined()
      })
      it('persist to server file under users directory the server', async() => {
        const url = await posts_storage.persist(posts)
        expect(url).toBe('/people/+16282281824/posts.html')
      })
      it('does nothing unless user is signed in', async() => {
        jest.spyOn(firebase, 'auth').mockImplementation(() => {
          return { currentUser: null }
        })
        const url = await posts_storage.persist(posts)
        expect(url).toBe('offline')
      })
    })
  })
})
