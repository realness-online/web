import { shallow } from 'vue-test-utils'
import Storage from '@/modules/Storage'
import Feed from '@/views/Feed'
describe('@/views/Feed.vue', () => {
  it('render feed info', () => {
    let wrapper = shallow(Feed)
    expect(wrapper.element).toMatchSnapshot()
  })
  it('#populate_feed', () => {
    let relations = [{
      first_name: 'katie',
      last_name: 'caffey',
      mobile: '2134445566'
    }]
    let wrapper = shallow(Feed)
    wrapper.vm.populate_feed(relations).then(() => {
      expect(wrapper.vm.feed.length).toBe(5)
    })
  })
})
