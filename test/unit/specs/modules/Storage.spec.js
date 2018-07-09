import Storage from '@/modules/Storage'
import as_form from '@/components/profile/as-form'
import * as firebase from 'firebase/app'
import 'firebase/auth'

describe.only('@/modules/Storage.js', () => {
  let item_as_string, person
  beforeEach(() => {
    item_as_string = `
    <section itemscope itemtype="/person">
      <h1 itemprop="name">Scott Fryxell</h1>
    </section>`
    document.body.innerHTML = item_as_string
    person = new Storage('person')
  })
  describe('static methods', () => {
    describe('#hydrate', () => {
      it('exists', () => {
        expect(Storage.hydrate).toBeDefined()
      })
      it('will create an html fragmend from a string', () => {
        person = Storage.hydrate(item_as_string)
        expect(person.querySelectorAll('h1').length).toBe(1)
      })
    })
    describe('#persist', () => {
      it('exists', () => {
        expect(Storage.persist).toBeDefined()
      })
      it('saves a set of items to the server', () => {

      })
      it('resolves a promise when successfull')
      it('rejects a promise when when it fails')
    })
  })
  describe('instance methods', () => {
    describe('#from_storage', () => {
      beforeEach(() => {
        person.save()
      })
      it('exists', () => {
        expect(person.from_storage).toBeDefined()
      })
      it('loads an item from local storage', () => {
        const items = person.from_storage()
        expect(items.querySelectorAll('h1').length).toBe(1)
        expect(items.querySelectorAll('[itemprop="name"]').length).toBe(1)
      })
    })
    describe('#save', () => {
      it('exists', () => {
        expect(person.save).toBeDefined()
      })
      it('saves an item to local storage', () => {
        expect.assertions(1)
        person.save().then(result => expect(result).toBe('saved local & network'))
      })
    })
    describe('#get_download_url', () => {
      it('exists')
      it('resolves a promise with a download url')
      it('rejects a promise if user is not logged in')
    })
    describe('#as_list', () => {
      beforeEach(() => {
        person.save()
      })
      it('exists', () => {
        expect(person.as_list).toBeDefined()
      })
      it('creates list of objects', () => {
        expect.assertions(1)
        expect(person.as_list().length).toBe(1)
      })
    })
    describe('#as_object', () => {
      it('exists', () => {
        expect(person.as_object).toBeDefined()
      })
      it('will return the first item it finds', () => {
        expect.assertions(1)
        expect(person.as_object().name).toBe('Scott Fryxell')
      })
    })
  })
})
