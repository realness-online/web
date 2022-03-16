import { shallowMount, flushPromises } from '@vue/test-utils'
import { nextTick as next_tick } from 'vue'
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
    wrapper = await shallowMount(Navigation, {
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
    wrapper.vm.version = '1.0.0'
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
        wrapper = await shallowMount(Navigation, {
          global: {
            stubs: ['router-link', 'router-view']
          }
        })
        await flushPromises()
        expect(wrapper.vm.first_name).toBe('You')
      })
      it('Returns the users first name if set', () => {
        expect(wrapper.vm.first_name).toBe('Scott')
      })
    })
    describe('handling statement events', () => {
      it('posting:false should render the main navigation', async () => {
        expect(wrapper.vm.posting).toBe(false)
        await next_tick()
        expect(wrapper.element).toMatchSnapshot()
      })
      it.only('posting:true should hide main navigation', async () => {
        wrapper.vm.posting = true
        await next_tick()
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
