import Storage from '@/persistance/Storage'
import Local from '@/persistance/Local'
import { get, set } from 'idb-keyval'
const fs = require('fs')
const preferences = fs.readFileSync('./tests/unit/html/preferences.html', 'utf8')
describe('@/persistance/Local.js', () => {
  class Preferences extends Local(Storage) {}
  let local
  let mock_get
  let mock_set
  beforeEach(() => {
    mock_get = get.mockImplementation(_ => Promise.resolve({}))
    mock_set = set.mockImplementation(_ => Promise.resolve())
    local = new Preferences('/+16282281824/preferences')
  })
  afterEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  describe('#save', () => {
    it('Exists', () => {
      expect(local.save).toBeDefined()
    })
    it('Saves items locally', async () => {
      await local.save({ outerHTML: preferences })
      expect(mock_get).toBeCalled()
      expect(mock_set).toBeCalled()
      expect(localStorage.setItem).toBeCalled()
    })
    it('Only saves if there are items to save', () => {
      local.save()
      expect(localStorage.setItem).not.toBeCalled()
    })
    it('Creates and index of item hashes', async () => {
      mock_get.mockImplementationOnce(_ => Promise.resolve(null))
      await local.save({ outerHTML: preferences })
      expect(mock_get).toBeCalled()
      expect(mock_set).toBeCalled()
      expect(localStorage.setItem).toBeCalled()
    })
  })
})
