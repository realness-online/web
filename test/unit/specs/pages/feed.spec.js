import { shallow } from 'vue-test-utils'
import feed from '@/pages/feed'

describe('@/pages/feed.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(feed)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should create feed from my relationships', () => {
    // expect.assertions(1)
  })
})
