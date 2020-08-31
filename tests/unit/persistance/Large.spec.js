import Storage from '@/persistance/Storage'
import Large from '@/persistance/Large'
import { set, get, del } from 'idb-keyval'
const fs = require('fs')
const poster = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')

describe('@/persistance/Large.js', () => {
  class Picture extends Large(Storage) {}
  let pic
  beforeEach(() => {
    pic = new Picture('/+16282281824/pictures/1445347888')
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('#save', () => {
    it('Exists', () => {
      expect(pic.save).toBeDefined()
    })
    it('retrieves and ads to an already existing directory', async () => {
      const mock_get = get.mockImplementation(_ => Promise.resolve({ items: ['1555347888'] }))
      await pic.save(poster)
      expect(mock_get).toHaveBeenCalledTimes(1)
      expect(set).toHaveBeenCalledTimes(2)
    })
    it('Saves items to indexdb', async () => {
      await pic.save(poster)
      expect(get).toBeCalled() // checks locally for directory
      expect(set).toHaveBeenCalledTimes(2) // sets directory and poster
    })
    it('Only saves if there are items to save', async () => {
      await pic.save()
      expect(set).not.toBeCalled()
    })
  })

  describe('#save', () => {
    it('Exists', () => {
      expect(pic.delete).toBeDefined()
    })
    it('Removes item from local directory', async () => {
      const mock_get = get.mockImplementation(_ => Promise.resolve({ items: ['1555347888'] }))
      await pic.delete(poster)
      expect(mock_get).toHaveBeenCalledTimes(1)
      expect(del).toHaveBeenCalledTimes(1)
      expect(set).toHaveBeenCalledTimes(1)
    })
  })

})
