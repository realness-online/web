import PhoneBook from '@/modules/PhoneBook'
import Storage from '@/modules/LocalStorage'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const phonebook_as_text = `
  <div id="phonebook">
    <figure itemscope itemtype="/person" itemid='+16282281824'>
      <meta itemprop="created_at" content="2018-07-15T18:11:31.018Z">
      <meta itemprop="updated_at" content="2018-07-15T18:11:31.018Z">
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Scott</span><span itemprop="last_name">Fryxell</span></p>
        <a itemprop="mobile" content="+16282281824">+1 (628) 228-1824</a>
      </figcaption>
    </figure>
    <figure itemscope itemtype="/person" itemid='+12403800385‬'>
    <meta itemprop="created_at" content="2018-07-15T18:11:31.018Z">
    <meta itemprop="updated_at" content="2018-07-15T18:11:31.018Z">
      <svg><use itemprop="profile_vector" xlink:href="/static/icons.svg#silhouette"></use></svg>
      <figcaption>
        <p><span itemprop="first_name">Katie</span><span itemprop="last_name">Caffey</span></p>
        <a itemprop="mobile" content="+12403800385‬">+1 (240) 380-0385‬</a>
      </figcaption>
    </figure>
  <div>`
describe('@/modules/PhoneBook', () => {
  let phonebook
  beforeEach(() => {
    phonebook = new PhoneBook()
  })
  describe('#get_download_url', () => {
    it('exists', () => {
      expect(phonebook.get_download_url).toBeDefined()
    })
    it('resolves a promise with a download url', async() => {
      const url = await phonebook.get_download_url()
      expect(url).toBe('https://download_url/people/index.html')
    })
  })
  describe('#as_list', () => {
    it('should exist', () => {
      expect(phonebook.as_list).toBeDefined()
    })
    it('should download the most recent version of the phonebook', () => {
      fetch.mockResponseOnce(phonebook_as_text)
      phonebook.as_list().then(people => {
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
          id: '/+14152281824',
          first_name: 'Joe',
          last_name: 'mother',
          mobile: '14152281824',
          created_at: '2015-07-15T18:11:31.018Z',
          updated_at: '2012-07-16T18:12:21.552Z'
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
      jest.spyOn(phonebook, 'as_list')
      .mockImplementation(() => Promise.resolve(phone_list))
    })
    afterEach(() => {
      phone_list = null

    })
    it('should add new person to phone book', async() => {
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(_ => me)
      expect(phone_list.length).toBe(2)
      const people = await phonebook.sync_list()
      expect(people.length).toBe(3)
      expect(localStorage.setItem).toBeCalled()
      expect(localStorage.getItem('save-phonebook')).toBe('true')
    })
    it('should leave the phone book alone when my info is the same', async() => {
      phone_list.push(me)
      expect(phone_list.length).toBe(3)
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => me)
      const people = await phonebook.sync_list()
      expect(people.length).toBe(3)
      expect(people[2].updated_at).toBe(me.updated_at)
    })
  })
  describe('#save', () => {
    it('should not try to save phonebook unless it exists', async() => {
      const message = await phonebook.save()
      expect(message).toBe(null)
    })
    it('should save the phonebook', async() => {
      document.body.innerHTML = phonebook_as_text
      const url = await phonebook.save()
      expect(url).toBe('/people/index.html')
    })
  })
})
