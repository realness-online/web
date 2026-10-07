import { describe, it, expect } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Colors from '@/views/Colors.vue'

describe('@/views/Colors', () => {
  it('renders the color system reference', () => {
    const wrapper = mount(Colors)
    expect(wrapper.find('section#colors[data-page]').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Color')

    const roles = wrapper.findAll('article[itemprop="roles"] > ul > li')
    expect(roles.map(role => role.find('header code').text())).toEqual([
      '--accent',
      '--working',
      '--emphasis',
      '--warning'
    ])

    const paints = wrapper.findAll(
      'article[itemprop="variants"] > figure[itemscope]'
    )
    expect(paints.map(figure => figure.attributes('itemprop'))).toEqual([
      'water',
      'clay',
      'slate'
    ])
    paints.forEach(figure => expect(figure.findAll('ul > li')).toHaveLength(3))

    const layers = wrapper.findAll(
      'details[itemprop="geology"] > figure[itemscope]'
    )
    expect(layers.map(figure => figure.attributes('itemprop'))).toEqual([
      'sediment',
      'sand',
      'gravel',
      'rocks',
      'boulders'
    ])
    layers.forEach(figure => expect(figure.findAll('ul > li')).toHaveLength(3))

    expect(
      wrapper.findAll(
        'details[itemprop="geology"] > figure:last-of-type ol > li'
      )
    ).toHaveLength(5)

    expect(
      wrapper.findAll('article[itemprop="palette"] > figure ul li')
    ).toHaveLength(4)

    expect(
      wrapper.findAll('article[itemprop="signals"] > ul > li')
    ).toHaveLength(2)
    expect(
      wrapper.findAll(
        'article[itemprop="surfaces"] > figure:first-of-type ol > li'
      )
    ).toHaveLength(5)
  })
})
