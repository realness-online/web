import { shallow } from 'vue-test-utils'
import post_list from '@/components/posts/as-list'
describe('@/components/posts/as-list.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(post_list, {
      propsData: { posts: [] }
    })
  })
  it('should render proper microdata for posts', () => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=posts]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
})
