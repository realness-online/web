import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'
import as_address from '@/components/profile/as-address'

// Mock the use_me composable
vi.mock('@/use/people', () => ({
  use_me: () => ({
    me: ref({
      id: '/+14151234356',
      name: 'Scott Fryxell'
    })
  })
}))

const person = {
  id: '/+14151234356',
  name: 'Scott Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}

describe('@/component/profile/as-address.vue', () => {
  let wrapper

  beforeEach(() => {
    wrapper = shallowMount(as_address, { props: { person } })
  })

  describe('Renders', () => {
    it('A person as an address element', () => {
      expect(wrapper.find('address[itemscope]').exists()).toBe(true)
      expect(wrapper.find('h3[itemprop="name"]').text()).toBe('Scott Fryxell')
    })

    it('renders address element with person data', () => {
      // The component renders the basic structure correctly
      expect(wrapper.find('address[itemscope]').exists()).toBe(true)
      expect(wrapper.find('address').attributes('itemid')).toBe('/+14151234356')
    })

    it('does not show avatar when not provided', async () => {
      const person_without_avatar = { ...person }
      delete person_without_avatar.avatar

      await wrapper.setProps({ person: person_without_avatar })
      expect(wrapper.find('link[itemprop="avatar"]').exists()).toBe(false)
    })
  })

  describe('Props', () => {
    it('accepts person prop', () => {
      expect(wrapper.props('person')).toEqual(person)
    })

    it('accepts editable prop', () => {
      wrapper = shallowMount(as_address, {
        props: { person, editable: true }
      })
      expect(wrapper.props('editable')).toBe(true)
    })

    it('defaults editable to false', () => {
      expect(wrapper.props('editable')).toBe(false)
    })
  })

  describe('Computed Properties', () => {
    it('uses person data correctly', () => {
      expect(wrapper.find('address').attributes('itemid')).toBe('/+14151234356')
      expect(wrapper.find('h3[itemprop="name"]').text()).toBe('Scott Fryxell')
    })
  })
})
