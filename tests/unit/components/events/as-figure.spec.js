import { shallow } from 'vue-test-utils'
import as_figure from '@/components/events/as-figure'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_items(poster_html)[0]
const author = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281823'
}
const event = {
  id: new Date(2020, 1, 1).getTime(),
  url: `${author.id}/${poster.id}`
}
describe('@/components/events/as-figure.js', () => {
  let wrapper
  beforeEach(() => {
    wrapper =  shallow(as_figure, { propsData: { event } })
  })
  it('Renders a figure element of an event', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
})
