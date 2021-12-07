import { shallowMount } from '@vue/test-utils'
import as_fill_figure from '@/components/posters/as-fill-figure'
import { migrate_poster } from '@/use/vector'
import get_item from '@/use/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
let poster = get_item(poster_html)
poster = migrate_poster(poster)
const itemid = '/+16282281824/posters/559666932867'
describe('@/components/posters/as-fill-figure.vue', () => {
  describe('Renders', () => {
    it('a menu to edit a poster', () => {
      const wrapper = shallowMount(as_fill_figure, {
        props: { poster, itemid }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
