import { shallow } from 'vue-test-utils'
import as_search from '@/components/profile/as-search'
describe('@/compontent/profile/as-search.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_search)
  })
  it('Render an input for search', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('go into search mode when clicked', () => {
    let search = wrapper.find('#search')
    search.trigger('focusin')
    expect(wrapper.vm.searching).toBe(true)
  })
  it('Reset the input when focus is lost', () => {
    let search = wrapper.find('#search')
    search.trigger('focusin')
    expect(wrapper.vm.searching).toBe(true)
    search.trigger('focusout')
    expect(wrapper.vm.searching).toBe(false)
  })
})
