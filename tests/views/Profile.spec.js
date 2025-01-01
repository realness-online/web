import { shallowMount, flushPromises } from '@vue/test-utils'
import Profile from '@/views/Profile'
import * as itemid from '@/use/itemid'
const person = read_mock_file('@@/html/person.html')
import { ref, nextTick as next_tick } from 'vue'
const user = { phoneNumber: '+16282281824' }
vi.mock('vue-router')
vi.mock('@/use/people', () => {
  return {
    use: () => {
      return {
        load_relations: vi.fn(),
        load_person: vi.fn(),
        person: ref({
          id: `/${user.phoneNumber}`,
          type: 'person'
        }),
        relations: ref([])
      }
    }
  }
})

vi.mock('@/use/statements', () => {
  return {
    use: () => {
      return {
        for_person: vi.fn(),
        statements: ref([]),
        thought_shown: vi.fn()
      }
    }
  }
})

describe('@/views/Profile.vue', () => {
  describe('Renders', async () => {
    it('profile information for a phone number', async () => {
      // vi.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
      //   return { items: ['559666932867'] }
      // })
      const wrapper = shallowMount(Profile)
      wrapper.vm.route = { params: { phone_number: user.phoneNumber } }
      await next_tick()
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
    it('there not being posters', async () => {
      vi.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return { items: [] }
      })
      const wrapper = shallowMount(Profile)
      wrapper.vm.route = { params: { phone_number: '+14151231234' } }

      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
