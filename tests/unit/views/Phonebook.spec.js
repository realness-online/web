import { shallowMount } from '@vue/test-utils'
import phonebook from '@/views/PhoneBook'
import itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'

const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/views/Phonebook', () => {
  it('Render the phonebook', async () => {
    jest.spyOn(itemid, 'load').mockImplementationOnce(_ => person)
    const wrapper = await shallowMount(phonebook, {
      stubs: ['router-link']
    })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
})
