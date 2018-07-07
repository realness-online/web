import Storage from '@/modules/Storage'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import 'firebase/auth'

describe.only('@/modules/Storage.js', () => {
  let item_as_string, person
  beforeEach(() => {
    item_as_string = `
    <main id="profile" itemscope itemtype="/person" itemid='/person/666'>
      <section>
        <h1 itemprop="name">Scott Fryxell</h1>
        <h2 itemprop="nickname" data-value="scoot">lame</h2>
      </section>
    </main>`
    document.body.innerHTML = item_as_string
    person = new Storage('person')
  })
  describe('#hydrate', () => {
    it('exists', () => {
      expect(Storage.hydrate).toBeDefined()
    })
    it('will create an html fragmend from a string', () => {
      person = Storage.hydrate(item_as_string)
      expect(person.querySelectorAll('h1').length).toBe(1)
    })
  })
  describe('#from_storage', () => {
    it('exists', () => {
      expect(person.from_storage).toBeDefined()
    })
  })
  describe('#save()', () => {
    beforeEach(() => {
      // turn off persistence for this test
      person.persist = () => { return true }
    })
    it('exists', () => {
      expect(person.save).toBeDefined()
    })
    it('saves and loads an item from local storage', () => {
      expect(person.save()).toBe(true)
      const items = person.from_storage()
      expect(items.querySelectorAll('h1').length).toBe(1)
    })
  })
  describe('#sync', () => {
    beforeEach(() => {
      // const onAuthStateChanged = jest.fn(state_changed => state_changed())
      const onAuthStateChanged = jest.fn(state_changed => {
        state_changed({user: person})
      })

      let auth_mock = jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged }
      })

      let storage_mock = jest.spyOn(firebase, 'storage').mockImplementation(() => {
        return {
          ref: jest.fn(() => {
            return {
              child: jest.fn(() => {
                return {
                  getDownloadURL: jest.fn(() => Promise.resolve('http://example.com/file.html'))
                }
              })
            }
          })
        }
      })

    })
    it('exists', () => {
      expect(person.sync).toBeDefined()
    })
    it('syncs posts from server to local storage', () => {
      person.sync()
    })
  })
  describe('#persist', () => {
    it('exists', () => {
      expect(person.persist).toBeDefined()
    })
    it('does not save activity to the server')
    it('only saves posts, profile, profile_image')
  })
  describe('retrieving objects from html', () => {
    describe('as_list()', () => {
      it('exists', () => {
        expect(person.as_list).toBeDefined()
      })
      it('will return a list of items')
    })
    describe('as_object()', () => {
      it('exists', () => {
        expect(person.as_object).toBeDefined()
      })
      it('will return the first item it finds')
    })
  })
  describe('indexing', () => {
    it('creates an index page for posts')
    it('creates an global index page of users to search')
    it('updates a search index of users when they are saved')
  })
})
