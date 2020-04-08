import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const my_itemid = '/+16282281824/posters/559666932867'

const fetch = require('jest-fetch-mock')

describe('@/helpers/itemid', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.getItem.mockClear()
    localStorage.setItem.mockClear()
  })
  describe('#load', () => {
    it('Item is on the page', async () => {
      const get_id_spy = jest.fn(() => poster_html)
      const keeps = document.getElementById
      document.getElementById = get_id_spy
      const poster = (await itemid.load(my_itemid))[0]
      await flushPromises()
      expect(get_id_spy).toBeCalled()
      expect(poster.viewbox).toBe('0 0 333 444')
      expect(poster.id).toBe(my_itemid)
      document.getElementById = keeps
    })
    describe('It\'s someone elses stuff', () => {
      it('It tries indexdb', () => {
        itemid.load(my_itemid, '/+14152281824')
        expect(localStorage.getItem).not.toBeCalled()
        expect(get).toBeCalled()
      })
    })
    describe('It\'s my stuff', () => {
      it.todo('it tries local storage first')
      it.todo('If tries indexdb')
    })
    describe('Can\'t find it locally', () => {
      let network_request, poster
      beforeEach(async () => {
        network_request = fetch.mockResponseOnce(poster_html)
        poster = (await itemid.load(my_itemid, '/+16282281824'))[0]
        await flushPromises()
      })
      it('Try the network', async () => {
        expect(poster.viewbox).toBe('0 0 333 444')
        expect(poster.id).toBe(my_itemid)
        expect(network_request).toBeCalled()
      })
      it('Saves it to indexdb when loaded', () => {
        expect(set).toBeCalled()
      })
    })
  })
})
