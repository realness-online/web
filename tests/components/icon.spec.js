import { shallowMount } from '@vue/test-utils'
import icon from '@/components/icon'

describe('@/components/icon', () => {
  describe('Renders', () => {
    it('An icon', () => {
      const wrapper = shallowMount(icon, {
        props: { name: 'realness' }
      })
      expect(wrapper.find('svg.icon').exists()).toBe(true)
      expect(wrapper.find('svg').classes()).toContain('realness')
      expect(wrapper.find('use').attributes('href')).toContain('#realness')
    })
  })

  describe('Props', () => {
    it('accepts name prop', () => {
      const wrapper = shallowMount(icon, {
        props: { name: 'test-icon' }
      })
      expect(wrapper.props('name')).toBe('test-icon')
      expect(wrapper.find('svg').classes()).toContain('test-icon')
    })
  })
})
