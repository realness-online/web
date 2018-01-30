import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import events from '@/events'

describe('index.vue', () => {
  it('renders event information', () => {
    let wrapper = shallow(events)
    expect(wrapper.element).toMatchSnapshot()
  })
})
