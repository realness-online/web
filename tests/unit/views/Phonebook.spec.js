import { shallow } from 'vue-test-utils'
import phonebook from '@/views/Phonebook'
import PhoneBook from '@/modules/PhoneBook'
import Item from '@/modules/item'
import Storage from '@/modules/Storage'
import profile_id from '@/models/profile_id'
const fs = require('fs')
const phonebook_as_text = fs.readFileSync('./tests/unit/html/phonebook.html', 'utf8')
const people = Item.get_items(Storage.hydrate(phonebook_as_text))
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const save_spy = jest.fn(() => Promise.resolve('save_spy'))
jest.spyOn(PhoneBook.prototype, 'sync_list').mockImplementation(() => {
  return Promise.resolve(people)
})
jest.spyOn(PhoneBook.prototype, 'save').mockImplementation(save_spy)
jest.spyOn(profile_id, 'load').mockImplementation(() => person)
describe('@/views/Phonebook', () => {
  it('Render the phonebook', () => {
    let wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('Saves the phone book when save-phonebook is set on localStorage', async () => {
    let wrapper = shallow(phonebook)
    wrapper.vm.phonebook.push(person)
    expect(wrapper.vm.phonebook.length).toBe(1)
    expect(save_spy).not.toBeCalled()
    localStorage.setItem('save-phonebook', 'true')
    await wrapper.vm.phonebook.push(person)
    expect(wrapper.vm.phonebook.length).toBe(2)
    wrapper.vm.$nextTick(() => expect(save_spy).toBeCalled())
    save_spy.mockClear()
  })
})
