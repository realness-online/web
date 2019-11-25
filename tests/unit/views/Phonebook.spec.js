import { shallow } from 'vue-test-utils'
import phonebook from '@/views/Phonebook'
import Item from '@/modules/item'
import profile from '@/helpers/profile'
import * as firebase from 'firebase/app'
import 'firebase/storage'

const fs = require('fs')
const phonebook_as_text = fs.readFileSync('./tests/unit/html/phonebook.html', 'utf8')
const people = Item.get_items(phonebook_as_text)
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}

const save_spy = jest.fn(() => Promise.resolve('save_spy'))
jest.spyOn(profile, 'load').mockImplementation(() => person)
describe('@/views/Phonebook', () => {
  it('Render the phonebook', () => {
    let wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
})
