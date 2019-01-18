import { shallow } from 'vue-test-utils'
import events from '@/views/events'

describe('@/views/events.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(events)
    expect(wrapper.element).toMatchSnapshot()
  })
})
