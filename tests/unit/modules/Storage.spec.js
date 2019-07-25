import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import flushPromises from 'flush-promises'
import growth from '@/modules/growth'
const fs = require('fs')
const not_signed_in = jest.fn(state_changed => state_changed())
const is_signed_in = jest.fn(state_changed => {
  state_changed({
    phoneNumber: '+16282281824'
  })
})
const too_big_in_bytes = growth.first() * 1024
const server_text = `
  <div itemprop="posts" itemref="profile">
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">This is a word</blockquote> <time itemprop="created_at" datetime="2018-04-13T20:02:50.533Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">These are some words.</blockquote> <time itemprop="created_at" datetime="2018-07-05T23:25:58.145Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">I am writing some words right now testing some magical magic out</blockquote> <time itemprop="created_at" datetime="2018-07-07T20:13:42.760Z">2 days ago</time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">zipper faced monkey</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:11:51.460Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">from the bottom of the zero's</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:44:05.363Z"></time></article>
  </div>`
const local_text = `
  <div itemprop="posts" itemref="profile">
  <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">zipper faced monkey</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:11:51.460Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">from the bottom of the zero's</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:44:05.363Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">Now I'm syncing like a magic man</blockquote> <time itemprop="created_at" datetime="2018-07-07T23:45:52.437Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">saying some more stuff.</blockquote> <time itemprop="created_at" datetime="2018-07-08T00:40:11.686Z"></time></article>
   <article itemscope="itemscope" itemtype="/post"><blockquote itemprop="articleBody">oh my god words!</blockquote> <time itemprop="created_at" datetime="2018-07-08T00:41:28.585Z"></time></article>
  </div>
  `
describe('@/modules/Storage.js', () => {
  let storage
  beforeEach(() => {
    jest.spyOn(firebase, 'auth').mockImplementation(() => {
      return { onAuthStateChanged: is_signed_in }
    })
  })
  afterEach(() => {
    localStorage.clear();
    // jest.resetAllMocks()
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
      it('exists', () => {
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
      it('rejects a promise if user is not logged in', () => {
        jest.spyOn(firebase, 'auth').mockImplementation(() => {
          return { onAuthStateChanged: not_signed_in }
        })
        storage.get_download_url().catch(e => {
          expect(e.message).toEqual('you must be signed in to get a download url')
        })
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
      it('syncs posts from server to local storage', async() => {
        fetch.mockResponseOnce(server_text)
        localStorage.setItem('posts', local_text)
        const list = await posts_storage.sync_list()
        expect(list.length).toBe(8)
      })
    })
  })
  describe('persistance', () => {
    let posts, posts_storage
    beforeEach(() => {
      posts = fs.readFileSync('./tests/unit/modules/posts.html', 'utf8')
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
          return { onAuthStateChanged: not_signed_in }
        })
        const url = await posts_storage.persist(posts)
        expect(url).toBe('offline')
      })
    })
  })
})
