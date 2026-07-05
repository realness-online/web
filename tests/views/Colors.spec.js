import { describe, it, expect } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Colors from '@/views/Colors.vue'

describe('@/views/Colors', () => {
  it('renders the color system reference', () => {
    const wrapper = mount(Colors)
    expect(wrapper.find('section#colors.page').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Color')

    const roles = wrapper.findAll('dl > dt')
    expect(roles.map(dt => dt.text())).toEqual([
      '--accent',
      '--emphasis',
      '--danger',
      '--warning',
      '--caution',
      '--success'
    ])

    const shelf = wrapper.findAll('figure[data-material]')
    expect(shelf.map(figure => figure.attributes('data-material'))).toEqual([
      'water',
      'clay',
      'moss',
      'slate',
      'heather'
    ])
    shelf.forEach(figure => expect(figure.findAll('li')).toHaveLength(3))

    expect(wrapper.findAll('[data-strip="signals"] > li')).toHaveLength(2)
    expect(wrapper.findAll('[data-strip="neutrals"] > li')).toHaveLength(5)
    expect(wrapper.findAll('[data-strip="surfaces"] > li')).toHaveLength(5)
  })
})
