import { shallowMount } from '@vue/test-utils'
import itemid, { as_type, as_author } from '@/helpers/itemid'
import Events from '@/views/Events'
describe('@/views/Events.vue', () => {
  let load
  beforeEach(() => {
    localStorage.me = '/+'
    load = jest.spyOn(itemid, 'list')
    .mockImplementation(itemid => {
      if (as_type(itemid) === 'relations') {
        return [
          { id: '/+14153451275' },
          { id: '/+17075539126' },
          { id: '/+15104512765' }
        ]
      } else {
        return [{
          id: `${as_author(itemid)}/events/${Date.now()}`,
          url: `${as_author(itemid)}/posters/${Date.now()}`
        }]
      }
    })
  })
  afterEach(() => jest.resetAllMocks())
  it('Renders list of upcoming events', () => {
    const wrapper = shallowMount(Events, {
      stubs: ['router-link']
    })
    expect(wrapper.element).toMatchSnapshot()
    expect(load).toBeCalled()
  })
})
