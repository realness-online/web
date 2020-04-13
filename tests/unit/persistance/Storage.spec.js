import Storage { Posts } from '@/persistance/Storage'
const fs = require('fs')
const preferences = fs.readFileSync('./tests/unit/html/preferences.html', 'utf8')

describe ('@/persistance/Storage.js', () => {
  describe ('Storage', () => {
    let storage
    beforeEach(() => {
      storage = new Storage('preferences')
    })
    afterEach(() => {
      localStorage.setItem.mockClear();
      localStorage.clear()
    })
    describe ('#as_list', () => {
      it ('Exists', () => {
        expect(storage.as_list).toBeDefined()
      })
      it ('Creates list of objects', async () => {
        localStorage.setItem(storage.selector, preferences)
        const list = await storage.as_list()
        expect(list.length).toBe(1)
      })
    })
    describe ('#as_object', () => {
      it ('Exists', () => {
        expect(storage.as_object).toBeDefined()
      })
      it ('Will return the first item it finds', () => {
        localStorage.setItem(storage.selector, preferences)
        const my_pref = storage.as_object()
        expect(my_pref.salutation).toBe('Mr. Scott')
      })
    })
    describe ('#save', () => {
      it ('Exists', () => {
        expect(storage.save).toBeDefined()
      })
      it ('Saves items locally and on the server', () => {
        storage.save(preferences)
        expect(localStorage.setItem).toBeCalled()
      })
      it ('Only saves if there are items to save', () => {
        storage.save()
        expect(localStorage.setItem).not.toBeCalled()
      })
    })
    describe ('#as_kilobytes', () => {
      it ('Exists', () => {
        expect(storage.as_kilobytes).toBeDefined()
      })
      it ('Tells the size of the item in local storage', () => {
        localStorage.setItem(storage.selector, preferences)
        expect(storage.as_kilobytes()).toBe('0.21')
      })
      it ('returns zero if nothing in storage', () => {
        expect(storage.as_kilobytes()).toBe(0)
      })
    })
  })
  describe ('Posts', () => {
    let storage
    beforeEach(() => {
      storage = new Posts()
    })
    describe ('#save', () => {

    })
  })
})
