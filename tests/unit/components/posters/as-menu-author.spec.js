import { shallowMount } from '@vue/test-utils'
import as_author_menu from '@/components/posters/as-menu-author'
import get_item from '@/use/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
let poster = get_item(poster_html)
describe('@/components/posters/as-menu-author.vue', () => {
  describe('Renders', () => {
    it('a menu to edit a poster', () => {
      const wrapper = shallowMount(as_author_menu, { props: { poster } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
