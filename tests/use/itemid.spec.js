import { beforeEach as before_each, afterEach as after_each } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { get, set } from 'idb-keyval'
import {
  as_author,
  as_directory,
  as_directory_id,
  load_directory_from_network,
  as_download_url,
  as_fragment,
  as_filename,
  as_path_parts,
  as_query_id,
  as_storage_path,
  as_type,
  is_history,
  load,
  type_as_list
} from '@/use/itemid'
import { current_user } from '@/use/serverless'
import get_item from '@/use/item'

const poster_html = read_mock_file('@@/html/poster.html')

describe('@/use/itemid', () => {
  const posterid = '/+16282281824/posters/559666932867'
  const user = { phoneNumber: '/+16282281824' }
  before_each(() => {
    vi.clearAllMocks()
  })
  after_each(() => {})
  describe('#as_author', () => {
    const itemid = '/+16282281824/statements/1583955101461'
    it('Should return an author id for a statement id', () => {
      expect(as_author(itemid)).toBe('/+16282281824')
    })
    it('Should return null for an empty id', () => {
      expect(as_author('/')).toBe(null)
    })
    it('Should return null for non author string', () => {
      expect(as_author('sync:index')).toBe(null)
    })
  })
  describe('#as_directory', () => {
    it('Exists', () => {
      expect(as_directory).toBeDefined()
    })
    it('Returns a directory when offline', async () => {
      const mock_get = get.mockImplementationOnce(() =>
        Promise.resolve({ items: ['1555347888'] })
      )
      await as_directory('/+/posters/')
      expect(mock_get).toBeCalled()
    })
    it('Returns a directory', async () => {
      current_user.value = user
      const mock_get = get.mockImplementationOnce(() => Promise.resolve(null))
      await as_directory('/+/posters/')
      await flushPromises()
      expect(mock_get).toBeCalled()
      expect(set).toBeCalled()
      current_user.value = null
    })
    it('Returns null if not online and not found locally directory', async () => {
      // const spy = vi.spyOn(window.navigator, 'onLine', 'get')
      // spy.mockReturnValue(false)
      const directory = await as_directory('/+/posters/')
      expect(get).toBeCalled()
      expect(directory.items.length).toBe(0)
      expect(directory.types.length).toBe(0)
      // spy.mockReset()
    })
  })
  describe('#as_directory_id', () => {
    it('Returns /+/posters for /+/posters/559666932867', () => {
      expect(as_directory_id('/+/posters/559666932867')).toBe('/+/posters/')
    })
    it('Returns /+16282281824/posters for /+/posters/559666932867', () => {
      expect(as_directory_id('/+16282281824/posters/559666932867')).toBe(
        '/+16282281824/posters/'
      )
    })
  })
  describe('#load_directory_from_network', () => {
    it('Returns an empty directory object', async () => {
      current_user.value = user
      const itemid = '/+16282281824/statements/1583955101461'
      const directory = await load_directory_from_network(itemid)
      expect(directory.items.length).toBe(0)
      expect(directory.types.length).toBe(0)
      current_user.value = null
    })
  })
  describe('#as_download_url', () => {
    it('Exists', () => {
      expect(as_download_url).toBeDefined()
    })
    it('Returns a url', async () => {
      current_user.value = user
      const url = await as_download_url(posterid)
      expect(url).toBe('/path/to/file.html')
      current_user.value = null
    })
    it('Returns null if person is not logged in', async () => {
      current_user.value = null
      const url = await as_download_url(posterid)
      expect(url).toBe(null)
    })
  })
  describe('#as_filename', () => {
    it('Returns /people/+16282281824/index.html for /+16282281824', () => {
      expect(as_filename('/+16282281824')).toBe(
        '/people/+16282281824/index.html'
      )
    })
    it('Returns /activity/index.html for /activity', () => {
      expect(as_filename('/activity')).toBe('/activity/index.html')
    })
  })
  describe('#as_fragment', () => {
    it('return fragment id', () => {
      expect(as_fragment(posterid)).toBe('#16282281824-posters-559666932867')
    })
  })
  describe('#as_path_parts', () => {
    it('can handle a link without a slash', () => {
      const result = as_path_parts('what')
      expect(result.length).toBe(1)
    })
  })
  describe('#as_query_id', () => {
    it('returns the proper id', () => {
      expect(as_query_id(posterid)).toBe('16282281824-posters-559666932867')
    })
  })
  describe('#as_storage_path', () => {
    it('Gives null for empty string', () => {
      expect(as_storage_path('')).toBe(null)
    })
    it('Gives person for /+14156281828', () => {
      expect(as_storage_path('/+14156281828')).toBe('/people/+14156281828')
    })
    it('Gives avatars for /+14156281828/avatars', () => {
      expect(as_storage_path('/+14156281828/avatars')).toBe(
        '/people/+14156281828/avatars'
      )
    })
    it('Gives /people/+14156281828/avatars for /+14156281828/avatars/559666932867', () => {
      expect(as_storage_path('/+14156281828/avatars/559666932867')).toBe(
        '/people/+14156281828/avatars'
      )
    })
  })
  describe('#as_type', () => {
    it('Gives person for /+', () => {
      expect(as_type('/+')).toBe('person')
    })
    it('Gives person for /+14156281828', () => {
      expect(as_type('/+14156281828')).toBe('person')
    })
    it('Gives person for /+14156281828/', () => {
      expect(as_type('/+14156281828/')).toBe('person')
    })
    it('Gives avatars for /+14156281828/avatars', () => {
      expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
    })
    it('Gives avatars for /+14156281828/avatars/', () => {
      expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
    })
    it('Gives avatars for /+14156281828/avatars/559666932867', () => {
      expect(as_type('/+14156281828/avatars/559666932867')).toBe('avatars')
    })
  })
  describe('#is_history', () => {
    const itemid = '/+16282281824/statements/1583955101461'
    it('can handle a link without a slash', () => {
      const result = is_history(itemid)
      expect(result).toBe(true)
    })
  })
  describe('#load', () => {
    describe("It's someone elses stuff", () => {
      before_each(async () => {
        await load(posterid, '/+14152281824')
      })
      it('tries indexdb', () => {
        expect(get).toBeCalled()
      })
      it('Does NOT try localStorage', () => {
        expect(localStorage.getItem).not.toBeCalled()
      })
    })
    describe("It's my stuff", () => {
      it('tries local storage first', () => {
        load(posterid, '/+16282281824')
        expect(localStorage.getItem).toHaveBeenCalledTimes(1)
      })
      it('tries indexdb', () => {
        load(posterid, '/+16282281824')
        expect(localStorage.getItem).toHaveBeenCalledTimes(1)
        expect(get).toHaveBeenCalledTimes(1)
      })
    })
    describe.skip("Can't find it locally", () => {
      let network_request, poster
      before_each(async () => {
        current_user.value = user

        network_request = fetch.mockResponseOnce(poster_html)
        poster = await load(posterid, '/+16282281824')
        await flushPromises()
      })
      after_each(() => {
        current_user.value = null
      })
      it('Try the network', async () => {
        expect(poster.viewbox).toBe('0 0 333 444')
        expect(poster.id).toBe(posterid)
        expect(network_request).toBeCalled()
      })
      it('Saves it to indexdb when loaded', () => {
        expect(set).toBeCalled()
      })
    })
  })
  describe('#type_as_list', () => {
    it('Return an empty list when called improperly', () => {
      const better_be_array = type_as_list()
      expect(Array.isArray(better_be_array)).toBe(true)
    })
  })
})
