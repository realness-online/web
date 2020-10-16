import { shallow } from 'vue-test-utils'
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
    wrapper = shallow(as_options, { propsData: { person: me, me: me, relations } })
  })
  it('Render a list of options for this profile', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('#is_relation', () => {
    it('Return true if profile is a relationship', () => {
      wrapper.vm.is_relation()
      expect(wrapper.vm.relation).toBe(true)
    })
    it('Return false if profile is not a relationship', () => {
      me.id = '/+14156661266'
      wrapper = shallow(as_options, { propsData: { person: me, me, relations } })
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
