import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
const fs = require('fs')
const poster = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe('@/helpers/itemid', () => {
  describe('#load', () => {
    it('if it has an id it tries to find on the page ')
    describe('device owner', () => {
      it('if it is pageable it gets it from local storage')
      it('if it is historical it tries to get it from indexdb')
      it('if it is immutable it tries to get it from indexdb')
    })
    it('if it is someone elses stuff it tries to get it from indexdb')
    it('if it is nowhere else it gets it from the network', async () => {
      fetch.mockResponseOnce(poster)
      const poster = await itemid.load('/+16282281824/posters/55234654346678')
      await flushPromises()
      expect(poster.viewbox).toBe('0 0 333 444')
      expect(poster).toBeCalled()
    })
  })
})
