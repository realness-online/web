import Item from '@/modules/Item'
import Storage, {posts_storage, phonebook_storage} from '@/modules/Storage'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'

const not_signed_in = jest.fn(state_changed => state_changed())
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: "6282281824"
  })
})
const storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
  return {
    ref: jest.fn(() => {
      return {
        child: jest.fn(() => {
          return {
            put: jest.fn((path) => Promise.resolve(path)),
            getDownloadURL: jest.fn((path) => Promise.resolve('http://some.google.com/example/path/file.html'))
          }
        })
      }
    })
  }
})
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
  let item_as_string, storage
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
    it('will create an html fragmend from a string', () => {
      storage = Storage.hydrate(item_as_string)
      expect(storage.querySelectorAll('h1').length).toBe(1)
    })
  })
  describe('#persist', () => {
    it('exists', () => {
      expect(storage.persist).toBeDefined()
    })
    it('persist to server file under users directory the server', () => {
      expect.assertions(1)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      storage.persist(item_as_string)
        .then(result => expect(result).toBe('/people/6282281824/person.html'))
    })
    it('does nothing unless user is signed in', () => {
      expect.assertions(1)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: not_signed_in }
      })
      storage.persist(item_as_string)
        .then(result => expect(result).toBe('no need to persist'))
    })
    it('can be told where to save', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      storage.persist(item_as_string, '/some/other/path')
        .then(result => expect(result).toBe('/some/other/path'))
    })
  })
  describe('#from_storage', () => {
    beforeEach(() => {
      storage.save()
    })
    it('exists', () => {
      expect(storage.from_storage).toBeDefined()
    })
    it('loads an item from local storage', () => {
      const items = storage.from_storage()
      expect(items.querySelectorAll('h1').length).toBe(1)
      expect(items.querySelectorAll('[itemprop="name"]').length).toBe(1)
    })
  })
  describe('#save', () => {
    it('exists', () => {
      expect(storage.save).toBeDefined()
    })
    it('saves an item to local storage', () => {
      expect.assertions(1)
      storage.save().then(result => expect(result).toBe('saved local & network'))
    })
  })
  describe('#get_download_url', () => {
    it('exists', () => {
      expect(storage.get_download_url).toBeDefined()
    })
    it('resolves a promise with a download url', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      expect.assertions(1)
      storage.get_download_url().then(url => {
        expect(url).toBe('http://some.google.com/example/path/file.html')
      })
    })
    it('rejects a promise if user is not logged in', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: not_signed_in }
      })
      expect.assertions(1)
      storage.get_download_url().catch(e => {
        expect(e.message).toEqual('you must be signed in to get a download url')
      })
    })
  })
  describe('#as_list', () => {
    beforeEach(() => {
      storage.save()
    })
    it('exists', () => {
      expect(storage.as_list).toBeDefined()
    })
    it('creates list of objects', () => {
      expect.assertions(1)
      expect(storage.as_list().length).toBe(1)
    })
  })
  describe('#as_object', () => {
    it('exists', () => {
      expect(storage.as_object).toBeDefined()
    })
    it('will return the first item it finds', () => {
      expect.assertions(1)
      expect(storage.as_object().name).toBe('Scott Fryxell')
    })
  })
  describe('#sync_list', () => {
    beforeEach(() => {
      storage = posts_storage
    })
    it('exists', () => {
      expect(storage.sync_list).toBeDefined()
    })
    it('syncs posts from server to local storage', () => {
      fetch.mockResponseOnce(server_text)
      localStorage.setItem('posts', local_text)
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      storage.sync_list().then((list) => {
        expect(list.length).toBe(8)
      })
    })
  })
})
