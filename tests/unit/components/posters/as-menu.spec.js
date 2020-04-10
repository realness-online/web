import { shallow } from 'vue-test-utils'
import as_menu from '@/components/posters/as-menu'
import Item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = Item.get_first_item(poster_html)
const author = {
  created_at: '2018-07-15T18:11:31.018Z',
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
const events = [{
  id: new Date(2020, 1, 1).getTime(),
  url: poster.id
}]
describe('@/compontent/posters/as-menu.vue', () => {
  let wrapper
  beforeEach(() => wrapper = shallow(as_menu, { propsData: { itemid: poster.id } }))
  describe('Renders', () => {
    it('a poster menu', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it ('a poster menu with an event', () => {
      wrapper.setProps({ events })
    })
  })
})
