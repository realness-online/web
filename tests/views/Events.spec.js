import { shallowMount } from '@vue/test-utils'
import * as itemid from '@/use/itemid'
import Events from '@/views/Events'
describe('@/views/Events.vue', () => {
  let list
  beforeEach(() => {
    localStorage.me = '/+'
    list = vi.spyOn(itemid, 'list').mockImplementation(id => {
      if (itemid.as_type(id) === 'relations') {
        return [
          { id: '/+14153451275' },
          { id: '/+17075539126' },
          { id: '/+15104512765' }
        ]
      } else {
        return [
          {
            id: `${itemid.as_author(id)}/events/${Date.now()}`,
            url: `${itemid.as_author(id)}/posters/${Date.now()}`
          }
        ]
      }
    })
  })
  afterEach(() => vi.resetAllMocks())
  describe('Renders', () => {
    it('List of upcoming events', async () => {
      const wrapper = await shallowMount(Events, {
        global: {
          stubs: ['router-link']
        }
      })
      expect(wrapper.element).toMatchSnapshot()
      expect(list).toBeCalled()
    })
  })
})
