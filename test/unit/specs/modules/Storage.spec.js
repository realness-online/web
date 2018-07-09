import Storage from '@/modules/Storage'
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
            getDownloadURL: jest.fn((path) => Promise.resolve('/example/path/file.html'))
          }
        })
      }
    })
  }
})

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
      expect(storage.save).toBeDefined()
    })
    it('resolves a promise with a download url', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      expect.assertions(1)
      storage.get_download_url().then(url => expect(url).toBe('/example/path/file.html'))
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

})
