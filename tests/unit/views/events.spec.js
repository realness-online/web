import { shallow } from 'vue-test-utils'
import Events from '@/views/events'

describe('@/views/Events.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(Events)
    expect(wrapper.element).toMatchSnapshot()
  })
})
