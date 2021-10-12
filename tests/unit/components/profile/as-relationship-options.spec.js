import { shallowMount } from '@vue/test-utils'
import as_options from '@/components/profile/as-relationship-options'
describe('@/compontent/profile/as-relationship-options.vue', () => {
  let wrapper
  const relations = [
    {
      id: '/+16282281824',
      first_name: 'Scott',
      last_name: 'Fryxell'
    },
    {
      id: '/+6336661624',
      first_name: 'Katie',
      last_name: 'Caffey'
    }
  ]
  const me = {
    id: '/+16282281824',
    first_name: 'Scott',
    last_name: 'Fryxell'
  }
  beforeEach(() => {
    wrapper = shallowMount(as_options, { props: { person: me, me: me, relations } })
  })
  describe('Renders', () => {
    it('A list of options for this profile', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#is_relation', () => {
      it('Return true if profile is a relationship', () => {
        wrapper.vm.is_relation()
        expect(wrapper.vm.relation).toBe(true)
      })
      it('Return false if profile is not a relationship', () => {
        me.id = '/+14156661266'
        wrapper = shallowMount(as_options, { props: { person: me, me, relations } })
        wrapper.vm.is_relation()
        expect(wrapper.vm.relation).toBe(false)
      })
    })
    describe('#update_relationship', () => {
      it('Tell the world to add a relationship', () => {
        wrapper.vm.relation = false
        const spy = jest.fn()
        wrapper.vm.$on('add', spy)
        wrapper.vm.update_relationship()
        expect(spy).toHaveBeenCalledTimes(1)
      })
      it('Tell the world to remove a relationship', () => {
        wrapper.vm.relation = true
        const spy = jest.fn()
        wrapper.vm.$on('remove', spy)
        wrapper.vm.update_relationship()
        expect(spy).toHaveBeenCalledTimes(1)
      })
    })
  })
})
