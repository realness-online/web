import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const fetch = require('jest-fetch-mock')
describe('@/helpers/itemid', () => {
  describe('#load', () => {
    it('first it tries to find the item on the page', () => {
      i
      expect(false).toBe(true)
    })
    describe('device owner', () => {
      it.todo('if it is pageable it gets it from local storage')
      it.todo('if it is historical it tries to get it from indexdb')
      it.todo('if it is immutable it tries to get it from indexdb')
    })
    it.todo('if it is someone elses stuff it tries to get it from indexdb')
    it('if it is nowhere else it gets it from the network', async () => {
      const test_id = '/+16282281824/posters/559666932867'
      const network_request = fetch.mockResponseOnce(poster_html)
      const poster = await itemid.load(test_id)
      await flushPromises()
      expect(poster.viewbox).toBe('0 0 333 444')
      expect(poster.id).toBe(test_id)
      expect(network_request).toBeCalled()
    })
  })
})
