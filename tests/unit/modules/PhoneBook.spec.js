import PhoneBook from '@/modules/PhoneBook'
import Storage from '@/modules/LocalStorage'
const fs = require('fs')
const phonebook_as_text = fs.readFileSync('./tests/unit/html/phonebook.html', 'utf8')
describe('@/modules/PhoneBook', () => {
  let phonebook
  beforeEach(() => {
    phonebook = new PhoneBook()
  })
  describe('#get_download_url', () => {
    it('Exists', () => {
      expect(phonebook.get_download_url).toBeDefined()
    })
    it('Returns a download url', async() => {
      const url = await phonebook.get_download_url()
      expect(url).toBe('https://download_url/people/index.html')
    })
  })
  describe('#as_list', () => {
    it('Exists', () => {
      expect(phonebook.as_list).toBeDefined()
    })
    it('Download the most recent version of the phonebook', () => {
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
    it('Add new person to phone book', async() => {
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(_ => me)
      expect(phone_list.length).toBe(2)
      const people = await phonebook.sync_list()
      expect(people.length).toBe(3)
      expect(localStorage.setItem).toBeCalled()
      expect(localStorage.getItem('save-phonebook')).toBe('true')
    })
    it('Leave the phone book alone when my info is the same', async() => {
      phone_list.push(me)
      expect(phone_list.length).toBe(3)
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => me)
      const people = await phonebook.sync_list()
      expect(people.length).toBe(3)
      expect(people[2].updated_at).toBe(me.updated_at)
    })
  })
  describe('#save', () => {
    it('Should not try to save phonebook unless it exists', async() => {
      const message = await phonebook.save()
      expect(message).toBe(null)
    })
    it('Save the phonebook', async() => {
      document.body.innerHTML = phonebook_as_text
      const url = await phonebook.save()
      expect(url).toBe('/people/index.html')
    })
  })
})
