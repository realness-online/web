import { shallow } from 'vue-test-utils'
import as_svg from '@/components/posters/as-svg'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_items(poster_html)[0]
describe('@/components/posters/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(as_svg, {
      propsData: { poster_id: poster.id }
    })
  })
  it('Render a poster', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
