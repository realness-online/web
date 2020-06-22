import Storage from '@/persistance/Storage'
import Large from '@/persistance/Large'
import { set } from 'idb-keyval'
const fs = require('fs')
const poster = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')

describe('@/persistance/Local.js', () => {
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
    it('Saves items to indexdb', () => {
      pic.save(poster)
      expect(set).toBeCalled()
    })
    it('Only saves if there are items to save', () => {
      pic.save()
      expect(set).not.toBeCalled()
    })
  })
})
