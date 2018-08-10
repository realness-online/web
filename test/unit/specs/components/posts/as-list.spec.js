import {shallow} from 'vue-test-utils'
import Storage from '@/modules/Storage'
import post_list from '@/components/posts/as-list'
import * as firebase from 'firebase/app'
import 'firebase/auth'
describe('@/components/posts/as-list.vue', () => {
  let wrapper
  const post = {
    created_at: '2017-12-20T23:01:14.310Z',
    articleBody: 'I like to move it'
  }
  beforeEach(() => {
    wrapper = shallow(post_list)
    wrapper.setProps({posts: []})
  })
  it('should render proper microdata for posts', () => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=posts]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
})
