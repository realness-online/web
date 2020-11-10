import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/posters/as-svg'
import get_item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
describe('@/components/posters/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_svg, {
      propsData: { itemid: poster.id }
    })
  })
  it('Render a poster', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
