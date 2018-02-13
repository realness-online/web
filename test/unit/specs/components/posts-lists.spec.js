import {shallow} from 'vue-test-utils'
import post_list from '@/components/posts-list'

describe('posts-list.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallow(post_list)
  })

  it('should render an activity wrapper (ol#activity)', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  it('should render some posts', () => {
    const post = {
      created_at: '2017-12-20T23:01:14.310Z',
      articleBody: 'I like to move it'
    }
    wrapper.setProps({posts: [post]}) // you can test watchers by setting props
    expect(wrapper.element).toMatchSnapshot()
  })

})
