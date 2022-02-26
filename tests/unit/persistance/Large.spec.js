import { jest } from '@jest/globals'
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
  describe('Methods', () => {
    describe('#save', () => {
      it('Exists', () => {
        expect(pic.save).toBeDefined()
      })
      it('Retrieves and ads to an already existing directory', async () => {
        get.mockImplementation(() => Promise.resolve({ items: ['1555347888'] }))
        get.mockImplementationOnce(() => Promise.resolve(null))
        await pic.save(poster)
        expect(get).toHaveBeenCalledTimes(2)
        expect(set).toHaveBeenCalledTimes(2)
      })
      it('Updates item in indexdb', async () => {
        get.mockImplementation(() => Promise.resolve({ items: ['1555347888'] }))
        get.mockImplementationOnce(() => Promise.resolve({}))
        await pic.save(poster)
        expect(get).toHaveBeenCalledTimes(1)
        expect(set).toHaveBeenCalledTimes(1)
      })
      it('Only saves if there are items to save', async () => {
        await pic.save()
        expect(set).not.toBeCalled()
      })
    })
    describe('#delete', () => {
      it('Exists', () => {
        expect(pic.delete).toBeDefined()
      })
      it('Removes item from local directory', async () => {
        get.mockImplementation(() => Promise.resolve({ items: ['1555347888'] }))
        await pic.delete(poster)
        expect(get).toHaveBeenCalledTimes(1)
        expect(del).toHaveBeenCalledTimes(1)
        expect(set).toHaveBeenCalledTimes(1)
      })
    })
  })
})
