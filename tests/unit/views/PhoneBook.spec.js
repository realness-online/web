import { shallowMount } from '@vue/test-utils'
import phonebook from '@/views/PhoneBook'
import * as itemid from '@/helpers/itemid'
import flushPromises from 'flush-promises'
import firebase from 'firebase/app'
import 'firebase/auth'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/views/PhoneBook', () => {
  let wrapper
  beforeEach(async () => {
    // jest.spyOn(itemid, 'load').mockImplementation(_ => person)
  })
  afterEach(() => {
    jest.clearAllMocks()
    firebase.user = null
  })
  describe('render', () => {
    it('Lets you know to sign in', async () => {
      wrapper = await shallowMount(phonebook, { stubs: ['router-link'] })
      expect(wrapper.vm.signed_in).toBe(false)
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Displays the phonebook when signed in', async () => {
      const mock_dir = {
        prefixes: ['+16282281824'],
        items: [],
        path: '/but/fake/path'
      }
      firebase.user = person
      firebase.storage_mock.listAll.mockImplementation(_ => Promise.resolve(mock_dir))
      jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(person))
      wrapper = await shallowMount(phonebook, { stubs: ['router-link'] })
      await flushPromises()
      expect(wrapper.vm.signed_in).toBe(true)
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Handles when a person not loading', async () => {
      const mock_dir = {
        prefixes: ['+16282281824'],
        items: [],
        path: '/but/fake/path'
      }
      firebase.user = person
      firebase.storage_mock.listAll.mockImplementation(_ => Promise.resolve(mock_dir))
      jest.spyOn(itemid, 'load').mockImplementation(_ => Promise.resolve(null))
      wrapper = await shallowMount(phonebook, { stubs: ['router-link'] })
      await flushPromises()
      expect(wrapper.vm.signed_in).toBe(true)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
