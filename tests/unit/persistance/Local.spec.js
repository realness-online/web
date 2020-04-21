import Storage from '@/persistance/Storage'
import Local from '@/persistance/Local'
const fs = require('fs')
const preferences = fs.readFileSync('./tests/unit/html/preferences.html', 'utf8')

describe ('@/persistance/Local.js', () => {
  class Preferences extends Local(Storage) {}
  let local
  beforeEach(() => {
    local = new Preferences()
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe ('#save', () => {
    it ('Exists', () => {
      expect(local.save).toBeDefined()
    })
    it ('Saves items locally and on the server', () => {
      local.save(preferences)
      expect(localStorage.setItem).toBeCalled()
    })
    it ('Only saves if there are items to save', () => {
      local.save()
      expect(localStorage.setItem).not.toBeCalled()
    })
  })
  describe ('#as_kilobytes', () => {
    it ('Exists', () => {
      expect(local.as_kilobytes).toBeDefined()
    })
    it ('Tells the size of the item in local storage', () => {
      localStorage.setItem(local.id, preferences)
      expect(local.as_kilobytes()).toBe('0.21')
    })
    it ('returns zero if nothing in storage', () => {
      expect(local.as_kilobytes()).toBe(0)
    })
  })
})
