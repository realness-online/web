import { shallowMount } from '@vue/test-utils'
import as_search from '@/components/profile/as-search'
describe('@/compontent/profile/as-search.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_search)
  })
  describe('Renders', () => {
    it('An input for search', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Events', () => {
    it('Go into search mode when clicked', () => {
      const search = wrapper.find('#search')
      search.trigger('focusin')
      expect(wrapper.vm.searching).toBe(true)
    })
    it('Reset the input when focus is lost', () => {
      const search = wrapper.find('#search')
      search.trigger('focusin')
      expect(wrapper.vm.searching).toBe(true)
      search.trigger('focusout')
      expect(wrapper.vm.searching).toBe(false)
    })
  })
})
