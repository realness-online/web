import Storage from '@/persistance/Storage'
const fs = require('fs')
const preferences = fs.readFileSync('./tests/unit/html/preferences.html', 'utf8')
describe('@/persistance/Storage.js', () => {
  afterEach(() => {
    localStorage.clear()
  })
  let storage
  beforeEach(() => {
    storage = new Storage('preferences')
    localStorage.setItem(storage.selector, preferences)
  })
  describe('#as_list', () => {
    it('Exists', () => {
      expect(storage.as_list).toBeDefined()
    })
    it('Creates list of objects', async () => {
      const list = await storage.as_list()
      expect(list.length).toBe(1)
    })
  })
  describe('#as_object', () => {
    it('Exists', () => {
      expect(storage.as_object).toBeDefined()
    })
    it('Will return the first item it finds', () => {
      const preferences = storage.as_object()
      expect(preferences.salutation).toBe('Mr. Scott')
    })
  })
  describe('#save', () => {
    it('Exists', () => {
      expect(storage.save).toBeDefined()
    })
    it('Saves items locally and on the server', () => {
      storage.save()
      expect(localStorage.setItem).toBeCalled()
    })
  })
})
