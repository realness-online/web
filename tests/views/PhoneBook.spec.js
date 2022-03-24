import { mount, flushPromises } from '@vue/test-utils'
import PhoneBook from '@/views/PhoneBook'
import * as itemid from '@/use/itemid'
import { listAll as list_directory } from 'firebase/storage'
import { current_user } from '@/use/serverless'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  visited: new Date().toISOString()
}
describe('@/views/PhoneBook', () => {
  let wrapper
  beforeEach(async () => {
    vi.spyOn(itemid, 'load').mockImplementation(() => person)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })
  describe('Renders', () => {
    it('Lets you know to sign in', async () => {
      wrapper = mount(PhoneBook, { global: { stubs: ['router-link'] } })
      await flushPromises()
      expect(wrapper.vm.current_user).toBe(null)
      expect(wrapper.element).toMatchSnapshot()
    })
    it.only('Displays the PhoneBook when signed in', async () => {
      const mock_dir = {
        prefixes: ['+16282281824'],
        items: [],
        path: '/but/fake/path'
      }
      current_user.value = {
        phoneNumber: '+16282281824'
      }
      list_directory.mockImplementation(() => Promise.resolve(mock_dir))
      vi.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(person))
      wrapper = mount(PhoneBook, { global: { stubs: ['router-link'] } })
      await flushPromises()
      expect(wrapper.vm.current_user).not.toBe(undefined)
      expect(wrapper.vm.current_user).not.toBe(null)
      expect(wrapper.element).toMatchSnapshot()
      current_user.value = null
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
      wrapper = mount(PhoneBook, { global: { stubs: ['router-link'] } })
      await flushPromises()
      expect(wrapper.vm.signed_in).toBe(true)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
