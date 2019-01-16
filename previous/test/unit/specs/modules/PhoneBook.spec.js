import {phonebook_storage} from '@/modules/PhoneBook'
import Storage from '@/modules/Storage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const is_signed_in = jest.fn((state_changed) => {
  state_changed({
    phoneNumber: '6282281824'
  })
})
const phonebook_as_text = `
  <div id="phonebook">
    <figure itemscope itemtype="/person" itemid='+16282281824'>
      <meta itemprop="created_at" content="2018-07-15T18:11:31.018Z">
      <meta itemprop="updated_at" content="2018-07-15T18:11:31.018Z">
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Scott</span><span itemprop="last_name">Fryxell</span></p>
        <a itemprop="mobile" data-value="+16282281824">+1 (628) 228-1824</a>
      </figcaption>
    </figure>
    <figure itemscope itemtype="/person" itemid='+12403800385‬'>
    <meta itemprop="created_at" content="2018-07-15T18:11:31.018Z">
    <meta itemprop="updated_at" content="2018-07-15T18:11:31.018Z">
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Katie</span><span itemprop="last_name">Caffey</span></p>
        <a itemprop="mobile" data-value="+12403800385‬">+1 (240) 380-0385‬</a>
      </figcaption>
    </figure>
  <div>`
describe('@/modules/PhoneBook', () => {
  describe('#get_download_url', () => {
    it('exists', () => {
      expect(phonebook_storage.get_download_url).toBeDefined()
    })
    it('resolves a promise with a download url', () => {
      jest.spyOn(firebase, 'auth').mockImplementation(() => {
        return { onAuthStateChanged: is_signed_in }
      })
      expect.assertions(1)
      phonebook_storage.get_download_url().then(url => {
        expect(url).toBe('https://download_url/people/index.html')
      })
    })
  })
  describe('#as_list', () => {
    it('should exist', () => {
      expect(phonebook_storage.as_list).toBeDefined()
    })
    it('should download the most recent version of the phonebook', () => {
      fetch.mockResponseOnce(phonebook_as_text)
      phonebook_storage.as_list().then(people => {
        expect(fetch).toBeCalled()
        expect(people.length).toBe(2)
      })
    })
  })
  describe('#sync_list', () => {
    let phone_list, me
    beforeEach(() => {
      phone_list = [
        {
          id: '/+16282281824',
          first_name: 'Scott',
          last_name: 'Fryxell',
          mobile: '6282281824',
          created_at: '2018-07-15T18:11:31.018Z',
          updated_at: '2018-07-16T18:12:21.552Z'
        },
        {
          id: '/+16336661624',
          first_name: 'Katie',
          last_name: 'Caffey',
          mobile: '6336661624',
          created_at: '2018-07-19T22:26:21.872Z',
          updated_at: '2018-07-18T22:27:09.086Z'
        }
      ]
      me = {
        id: '/+16282281824',
        first_name: 'Scott',
        last_name: 'Fryxell',
        mobile: '6282281824',
        created_at: '2018-07-15T18:11:31.018Z',
        updated_at: '2018-07-16T18:12:21.552Z'
      }
      jest.spyOn(phonebook_storage, 'as_list')
        .mockImplementation(() => Promise.resolve(phone_list))
    })
    afterEach(() => {
      jest.restoreAllMocks()
    })
    it('should add new person to phone book', () => {
      me.id = '/+14151234567'
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => me)
      expect(phone_list.length).toBe(2)
      phonebook_storage.sync_list().then(people => {
        expect(people.length).toBe(3)
      })
    })
    it('should leave the phone book alone when my info is the same', () => {
      expect.assertions(3)
      expect(phone_list.length).toBe(2)
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => me)
      phonebook_storage.sync_list().then(people => {
        expect(people.length).toBe(2)
        expect(people[0].updated_at).toBe(me.updated_at)
      })
    })
  })
  describe('#save', () => {
    it('should not try to save phonebook unless it exists', () => (
      phonebook_storage.save().then((message) => {
        expect(message).toBe('nothing to save')
      })
    ))
    it('should save the phonebook', () => {
      expect.assertions(1)
      jest.spyOn(phonebook_storage, 'persist').mockImplementation(() => Promise.resolve())
      document.body.innerHTML = phonebook_as_text
      phonebook_storage.save().then((message) => {
        expect(message).toBe('saved phonebook to server')
      })
    })
  })
})
