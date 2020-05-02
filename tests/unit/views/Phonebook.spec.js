import { shallow } from 'vue-test-utils'
import phonebook from '@/views/Phonebook'
import itemid from '@/helpers/itemid'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe ('@/views/Phonebook', () => {
  it ('Render the phonebook', () => {
    jest.spyOn(itemid, 'load').mockImplementationOnce(() => person)
    const wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
})
