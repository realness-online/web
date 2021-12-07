import { shallowMount } from '@vue/test-utils'
import as_author_menu from '@/components/posters/as-author-menu'
import { migrate_poster } from '@/use/vector'
import get_item from '@/use/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
let poster = get_item(poster_html)
poster = migrate_poster(poster)
describe('@/components/posters/as-author-menu.vue', () => {
  describe('Renders', () => {
    it('a menu to edit a poster', () => {
      const wrapper = shallowMount(as_author_menu, { props: { poster } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
