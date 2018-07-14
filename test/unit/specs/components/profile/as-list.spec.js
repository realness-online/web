import {shallow} from 'vue-test-utils'
import as_list from '@/components/profile/as-list'
describe('@/compontent/profile/as-list.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_list)
  })
  it('should render a list of people', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('creates an index page for people when')

  it('listens for an sign in event')
  it('creates an global index page of users to search')
  it('updates a search index of users when they are saved')
})
