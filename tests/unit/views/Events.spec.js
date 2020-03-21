import { shallow } from 'vue-test-utils'
import Events from '@/views/events'
describe('@/views/Events.vue', () => {
  it('Renders list of upcoming events', () => {
    const wrapper = shallow(Events)
    expect(wrapper.element).toMatchSnapshot()
    // const people_in_feed = relations_storage.as_list()
  })
})
