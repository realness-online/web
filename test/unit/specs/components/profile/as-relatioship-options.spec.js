import {shallow} from 'vue-test-utils'
import as_options from '@/components/profile/as-relationship-options'
import Storage from '@/modules/Storage'

describe('@/compontent/profile/as-relationship-options.vue', () => {
  let wrapper
  let relations = [
    {
      first_name: 'Scott',
      last_name: 'Fryxell',
      mobile: '6282281824',
      created_at: '2018-07-15T18:11:31.018Z',
      updated_at: '2018-07-16T18:12:21.552Z'
    },
    {
      first_name: 'Katie',
      last_name: 'Caffey',
      mobile: '6336661624',
      created_at: '2018-07-19T22:26:21.872Z',
      updated_at: '2018-07-18T22:27:09.086Z'
    }
  ]
  let me = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '6282281824',
    created_at: '2018-07-15T18:11:31.018Z',
    updated_at: '2018-07-16T18:12:21.552Z'
  }

  beforeEach(() => {
    jest.spyOn(Storage.prototype, 'as_list').mockImplementation(() => relations)
    wrapper = shallow(as_options, { propsData: { person: me } })
  })
  it('should render a list of options for this profile', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('#is_relation', () => {
    it('should return true if profile is a relationship', () => {
      wrapper.vm.is_relation()
      expect(wrapper.vm.relation).toBe(true)
    })
    it('should return false if profile is not a relationship', () => {
      me.mobile = '4156661266'
      wrapper = shallow(as_options, { propsData: { person: me } })
      wrapper.vm.is_relation()
      expect(wrapper.vm.relation).toBe(false)
    })
  })
  describe('#update_relationship', () => {
    it('should tell the world to add the relationship', () => {
      wrapper.vm.relation = false
      const spy = jest.fn()
      wrapper.vm.$bus.$on('add-relationship', spy)
      wrapper.vm.update_relationship()
      expect(spy).toHaveBeenCalledTimes(1)
    })
    it('should tell the world to remove the relationship', () => {
      wrapper.vm.relation = true
      const spy = jest.fn()
      wrapper.vm.$bus.$on('remove-relationship', spy)
      wrapper.vm.update_relationship()
      expect(spy).toHaveBeenCalledTimes(1)
    })

  })
})
