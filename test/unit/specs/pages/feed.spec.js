import { shallow } from 'vue-test-utils'
import feed from '@/pages/feed'

describe('@/pages/feed.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(feed)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should create feef from my relationships', () => {
    expect.assertions(1)
  })
})
