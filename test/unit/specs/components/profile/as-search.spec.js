import {shallow} from 'vue-test-utils'
import as_search from '@/components/profile/as-search'
describe('@/compontent/profile/as-list.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_search)
  })
  it('should render an input for search', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should go into search mode when clicked', () => {
    let search = wrapper.find('#search')
    search.trigger('focusin')
    expect(wrapper.vm.searching).toBe(true)
  })
  it('should go reset the Query when no longer focused', () => {
    let search = wrapper.find('#search')
    search.trigger('focusin')
    expect(wrapper.vm.searching).toBe(true)
    search.trigger('focusout')
    expect(wrapper.vm.searching).toBe(false)
  })
})
