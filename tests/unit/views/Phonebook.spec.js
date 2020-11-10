import { shallowMount } from '@vue/test-utils'
import phonebook from '@/views/Phonebook'
import itemid from '@/helpers/itemid'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/views/Phonebook', () => {
  it('Render the phonebook', () => {
    jest.spyOn(itemid, 'load').mockImplementationOnce(_ => person)
    const wrapper = shallowMount(phonebook, {
      stubs: ['router-link']
    })
    expect(wrapper.element).toMatchSnapshot()
  })
})
