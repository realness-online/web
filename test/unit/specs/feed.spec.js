import Vue from 'vue'
import { shallow } from 'vue-test-utils'
import feed from '@/feed'

describe('index.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(feed)
    expect(wrapper.element).toMatchSnapshot()
  })
})
