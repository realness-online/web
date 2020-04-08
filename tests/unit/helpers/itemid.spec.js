import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const test_id = '/+16282281824/posters/559666932867'
const fetch = require('jest-fetch-mock')

describe('@/helpers/itemid', () => {
  describe('#load', () => {
    it.only('First it tries to find the item on the page', async () => {
      const get_id_spy = jest.fn(() => poster_html)
      const keeps = document.getElementById
      document.getElementById = get_id_spy
      const poster = await itemid.load(test_id)
      expect(get_id_spy).toBeCalled()
      expect(poster.viewbox).toBe('0 0 333 444')
      expect(poster.id).toBe(test_id)
      document.getElementById = keeps
    })
    describe('Someone else\'s stuff', () => {
      it.todo('It tries indexdb')
    })
    describe('It\'s my stuff', () => {
      it.todo('If pageable it tries local storage')
      it.todo('If historical it tries indexdb')
      it.todo('If large it tries indexdb')
    })
    describe('Can\'t find it locally', () => {
      it('Try the network', async () => {
        const network_request = fetch.mockResponseOnce(poster_html)
        const poster = await itemid.load(test_id, '/+16282281824')
        await flushPromises()
        expect(poster.viewbox).toBe('0 0 333 444')
        expect(poster.id).toBe(test_id)
        expect(network_request).toBeCalled()
      })
    })
  })
})
