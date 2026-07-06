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
      '--info',
      '--danger',
      '--warning',
      '--caution',
      '--success'
    ])

    const shelf = wrapper.findAll('figure[itemscope]')
    expect(
      shelf.map(figure => figure.find('[itemprop="name"]').text())
    ).toEqual(['water', 'clay', 'moss', 'slate', 'heather'])
    shelf.forEach(figure => expect(figure.findAll('li')).toHaveLength(3))

    expect(wrapper.findAll('figure.strata ol li')).toHaveLength(5)
    expect(wrapper.find('figure.scene').exists()).toBe(true)
    expect(wrapper.findAll('figure.shelf ul li')).toHaveLength(7)

    const strips = wrapper.findAll('ul.catalog-strip')
    expect(strips).toHaveLength(2)
    expect(strips[0].findAll('li')).toHaveLength(2)
    expect(strips[1].findAll('li')).toHaveLength(6)
  })
})
