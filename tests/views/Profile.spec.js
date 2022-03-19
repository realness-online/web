import { shallowMount, flushPromises } from '@vue/test-utils'
import Profile from '@/views/Profile'
import * as itemid from '@/use/itemid'
import fs from 'fs'
const person = fs.readFileSync('./__mocks__/html/person.html', 'utf8')
import { nextTick as next_tick } from 'vue'
const user = { phoneNumber: '+16282281824' }
vi.mock('vue-router')
vi.mock('@/use/thought', () => {
  return {
    use_author_thoughts: () => {
      return {
        id: 1,
        load: vi.fn(),
        author: {
          avatar: 'womp',
          id: user.phoneNumber
        },
        statements: ref([]),
        thought_shown: vi.fn()
      }
    }
  }
})

describe('@/views/Profile.vue', () => {
  describe('Renders', async () => {
    it('profile information for a phone number', async () => {
      vi.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return { items: ['559666932867'] }
      })
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
