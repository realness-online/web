import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/avatars/as-svg'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356',
  avatar: '/+14151234356/avatars/559888845532'
}
describe('@/components/avatars/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_svg, {
      propsData: { person }
    })
  })
  it('Render an avatar', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('methods', () => {
    describe('#first_instance', () => {
      it('exists', () => {
        expect(wrapper.vm.first_instance).toBeDefined()
      })
      it('checks if item is already on page', () => {
        expect(wrapper.vm.first_instance()).toBe(true)
      })
    })
    describe('#show', () => {
      it('exists', () => {
        expect(wrapper.vm.show).toBeDefined()
      })
      it('checks if item is already on page', async () => {
        await wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).toBeTruthy()
      })
    })
  })
})
