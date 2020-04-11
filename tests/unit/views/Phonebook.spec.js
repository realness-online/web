import { shallow } from 'vue-test-utils'
import phonebook from '@/views/Phonebook'
import profile from '@/helpers/profile'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
jest.spyOn(profile, 'load').mockImplementation(() => person)
describe('@/views/Phonebook', () => {
  it('Render the phonebook', () => {
    const wrapper = shallow(phonebook)
    expect(wrapper.element).toMatchSnapshot()
  })
})
