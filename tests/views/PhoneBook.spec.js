import { shallowMount, flushPromises } from '@vue/test-utils'
import PhoneBook from '@/views/PhoneBook'
import * as itemid from '@/use/itemid'
import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  visited: new Date().toISOString()
}
describe('@/views/PhoneBook', () => {
  let wrapper
  beforeEach(async () => {
    // vi.spyOn(itemid, 'load').mockImplementation(() => person)
  })
  afterEach(() => {
    vi.clearAllMocks()
    firebase.user = null
  })
  describe('Renders', () => {
    it('Lets you know to sign in', async () => {
      wrapper = await shallowMount(PhoneBook)
      expect(wrapper.vm.signed_in).toBe(false)
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Displays the PhoneBook when signed in', async () => {
      const mock_dir = {
        prefixes: ['+16282281824'],
        items: [],
        path: '/but/fake/path'
      }
      firebase.user = person
      firebase.storage_mock.listAll.mockImplementation(() =>
        Promise.resolve(mock_dir)
      )
      vi.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(person))
      wrapper = await shallowMount(PhoneBook)
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
      firebase.storage_mock.listAll.mockImplementation(() =>
        Promise.resolve(mock_dir)
      )
      vi.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(null))
      wrapper = await shallowMount(PhoneBook)
      await flushPromises()
      expect(wrapper.vm.signed_in).toBe(true)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
