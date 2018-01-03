import Vue from 'vue'
import {shallow} from 'vue-test-utils'
import ProfileActivity from '@/components/profile-posts'

describe('profile-posts.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallow(ProfileActivity)
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
