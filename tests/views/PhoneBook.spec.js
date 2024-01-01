import { mount, shallowMount as shallow, flushPromises } from '@vue/test-utils'
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
    vi.useFakeTimers()
    vi.spyOn(itemid, 'load').mockImplementation(() => person)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })
  describe('Renders', () => {
    it('Lets you know to sign in', async () => {
      const date = new Date(2000, 1, 1, 13)
      vi.setSystemTime(date)
      expect(Date.now()).toBe(date.valueOf())

      wrapper = mount(PhoneBook, { global: { stubs: ['router-link'] } })
      await flushPromises()
      expect(wrapper.vm.current_user).toBe(null)
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Displays the PhoneBook when signed in', async () => {
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
      wrapper = shallow(PhoneBook, { global: { stubs: ['router-link'] } })
      await flushPromises()
      expect(wrapper.vm.current_user).not.toBe(undefined)
      expect(wrapper.vm.current_user).not.toBe(null)
      expect(wrapper.element).toMatchSnapshot()
      current_user.value = null
    })
  })
})
