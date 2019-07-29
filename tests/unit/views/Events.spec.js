import { shallow } from 'vue-test-utils'
import Events from '@/views/events'
describe('@/views/Events.vue', () => {
  it('Renders list of upcoming events', () => {
    let wrapper = shallow(Events)
    expect(wrapper.element).toMatchSnapshot()
  })
})
