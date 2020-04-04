import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
const fs = require('fs')
const poster = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe('@/helpers/itemid', () => {
  describe('#load', () => {
    it('tries to get if from the page')
    it('tries to get it from local_storage')
    it('tries to get it from indexdb')
    it('try to get it from the network', async () => {
      fetch.mockResponseOnce(poster)
      const poster = await itemid.load('/+16282281824/posters/55234654346678')
      await flushPromises()
      expect(poster.viewbox).toBe('0 0 333 444')
      expect(poster).toBeCalled()
    })
  })
})
