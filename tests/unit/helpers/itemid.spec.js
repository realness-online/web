import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import itemid, { as_download_url,
                 as_directory_path,
                 as_type } from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import { get, set } from 'idb-keyval'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const personid = '/+16282281824'
const posterid = '/+16282281824/posters/559666932867'
const avatarid = '/+16282281824/avatars/559666932867'
const fetch = require('jest-fetch-mock')

describe ('@/helpers/itemid', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.getItem.mockClear()
    localStorage.setItem.mockClear()
  })
  describe ('default itemid', () => {
    describe ('#load', () => {
      it ('Item is on the page', async () => {
        const get_id_spy = jest.fn(() => poster_html)
        const keeps = document.getElementById
        document.getElementById = get_id_spy
        const poster = (await itemid.load(posterid))[0]
        await flushPromises()
        expect(get_id_spy).toBeCalled()
        expect(poster.viewbox).toBe('0 0 333 444')
        expect(poster.id).toBe(posterid)
        document.getElementById = keeps
      })
      describe ('It\'s someone elses stuff', () => {
        beforeEach( async() => {
          await itemid.load(posterid, '/+14152281824')
        })
        it ('It tries indexdb', () => {
          expect(get).toBeCalled()
        })
        it ('Does NOT try localStorage', () => {
          expect(localStorage.getItem).not.toBeCalled()
        })
      })
      describe ('It\'s my stuff', () => {
        beforeEach(() => {
          itemid.load(posterid)
        })
        it ('It tries local storage first', () => {
          // first call to get item loads the users local profile
          expect(localStorage.getItem).toHaveBeenCalledTimes(2)
        })
        it ('It tries indexdb', () => {
          expect(get).toBeCalled()
        })
      })
      describe ('Can\'t find it locally', () => {
        let network_request, poster
        beforeEach(async () => {
          network_request = fetch.mockResponseOnce(poster_html)
          poster = (await itemid.load(posterid, '/+16282281824'))[0]
          await flushPromises()
        })
        it ('Try the network', async () => {
          expect(poster.viewbox).toBe('0 0 333 444')
          expect(poster.id).toBe(posterid)
          expect(network_request).toBeCalled()
        })
        it ('Saves it to indexdb when loaded', () => {
          expect(set).toBeCalled()
        })
      })
    })
    describe ('#as_object', () => {
      it ('calls load', async () => {
        const network_request = fetch.mockResponseOnce(poster_html)
        await itemid.as_object(posterid, '/+16282281824')
        await flushPromises()
        expect(network_request).toBeCalled()
      })
    })
    describe ('#as_query_id', () => {
      expect(itemid.as_query_id(posterid)).toBe('16282281824-posters-559666932867')
    })
    describe ('#as_fragment', () => {
      expect(itemid.as_fragment(posterid)).toBe('#16282281824-posters-559666932867')
    })
  })
  describe ('exports', () => {
    describe ('#as_type', () => {
      it ('gives person for /+14156281828', () => {
        expect(as_type('/+14156281828')).toBe('person')
      })
      it ('gives person for /+14156281828/', () => {
        expect(as_type('/+14156281828/')).toBe('person')
      })
      it ('gives avatars for /+14156281828/avatars', () => {
        expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
      })
      it ('gives avatars for /+14156281828/avatars/', () => {
        expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
      })
      it ('gives avatars for /+14156281828/avatars/559666932867', () => {
        expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
      })
    })
    describe.only ('#as_directory_path', () => {
      it ('gives person for /+14156281828', () => {
        expect(as_directory_path('/+14156281828'))
        .toBe('/people/+14156281828')
      })
      it ('gives avatars for /+14156281828/avatars', () => {
        expect(as_directory_path('/+14156281828/avatars'))
        .toBe('/people/+14156281828/avatars')
      })
      it ('gives /people/+14156281828/avatars for /+14156281828/avatars/559666932867', () => {
        expect(as_directory_path('/+14156281828/avatars/559666932867'))
        .toBe('/people/+14156281828/avatars')
      })
    })
    describe ('#as_download_url', () => {
      it ('exists', () => {
        expect(as_download_url).toBeDefined()
      })
      it ('Returns a url', async () => {
        const url = await as_download_url(posterid)
        expect(url).toBe('https://example.com/people/+16282281824/posters/559666932867.html')
      })
      it ('Returns null if person is not logged in', async () => {
        jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
          return { currentUser: null }
        })
        const url = await as_download_url(posterid)
        expect(url).toBe(null)
      })
    })
  })

})
