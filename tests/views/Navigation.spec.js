import { shallowMount, flushPromises } from '@vue/test-utils'
import Navigation from '@/views/Navigation'
import * as itemid from '@/use/itemid'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
describe('@/views/Navigation.vue', () => {
  let wrapper
  beforeEach(async () => {
    vi.spyOn(itemid, 'load').mockImplementation(() => person)
    wrapper = shallowMount(Navigation)
    wrapper.setData({ version: '1.0.0' })
    await flushPromises()
  })
  afterEach(() => {
    wrapper.unmount()
  })
  describe('Renders', () => {
    it('Displays statements and profile for a person', async () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    describe('first_name', () => {
      it("Returns 'You' by default", async () => {
        vi.spyOn(itemid, 'load').mockImplementationOnce(() => null)
        wrapper = shallowMount(Navigation)
        await flushPromises()
        expect(wrapper.vm.first_name).toBe('You')
      })
      it('Returns the users first name if set', () => {
        expect(wrapper.vm.first_name).toBe('Scott')
      })
    })
    describe('handling statement events', () => {
      it('posting:false should render the main navigation', () => {
        expect(wrapper.vm.posting).toBe(false)
        expect(wrapper.element).toMatchSnapshot()
      })
      it('posting:true should hide main navigation', () => {
        wrapper.setData({ posting: true })
        expect(wrapper.element).toMatchSnapshot()
      })
    })
  })
  describe('Methods', () => {
    describe('#done_posting', () => {
      it('Sets the focus on the post statement button', () => {
        const focus_mock = vi.spyOn(wrapper.vm.$refs.nav, 'focus')
        wrapper.vm.done_posting()
        expect(focus_mock).toBeCalled()
      })
    })
  })
})
