import { shallowMount } from '@vue/test-utils'
import icon from '@/components/icon'

describe('@/components/icon', () => {
  describe('Renders', () => {
    it('An icon', () => {
      const wrapper = shallowMount(icon, {
        props: { name: 'gear' }
      })
      expect(wrapper.find('svg.icon').exists()).toBe(true)
      expect(wrapper.find('svg').classes()).toContain('gear')
      expect(wrapper.find('use').attributes('href')).toContain('#gear')
    })

    // the realness logo is drawn inline (not via <use href="icons.svg#...">)
    // so its tile-drift animation can run — cross-document <use> references
    // don't reliably run CSS/SMIL animations
    it('The realness logo, inline and animated', () => {
      const wrapper = shallowMount(icon, {
        props: { name: 'realness' }
      })
      expect(wrapper.find('svg.icon').exists()).toBe(true)
      expect(wrapper.find('svg').classes()).toContain('realness')
      const uses = wrapper.findAll('use')
      expect(
        uses.every(use => !use.attributes('href')?.includes('icons.svg'))
      ).toBe(true)
      expect(wrapper.findAll('path[data-tile]')).toHaveLength(6)
      expect(wrapper.findAll('svg > use[data-tile]')).toHaveLength(6)
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
