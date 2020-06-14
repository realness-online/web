import { shallow } from 'vue-test-utils'
import itemid from '@/helpers/itemid'
import Events from '@/views/Events'
const events = {
  id: '/+{phone-number}/events',
  events: [{
    id: '/+16282281824/events/1588035067996',
    url: '/+16282281824/posters/1585005003428'
  }]
}
const relations = {
  id: '/+16282281824/relationss',
  relations: [
    { id: '/+14153451275' },
    { id: '/+17075539126' },
    { id: '/+15104512765' }
  ]
}
describe('@/views/Events.vue', () => {
  let load
  beforeEach(() => {
    load = jest.spyOn(itemid, 'list')
               .mockImplementationOnce(() => relations.relations)
               .mockImplementation(() => events.events)
  })
  it('Renders list of upcoming events', () => {
    const wrapper = shallow(Events)
    expect(wrapper.element).toMatchSnapshot()
    expect(load).toBeCalled()
  })
})
