import { shallow } from 'vue-test-utils'
import events from '@/pages/events'

describe('@/pages/events.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(events)
    expect(wrapper.element).toMatchSnapshot()
  })
})
