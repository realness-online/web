import { shallowMount } from '@vue/test-utils'
import as_background from '@/components/posters/as-background'
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
    it('a new background for a poster without one', () => {
      const wrapper = shallowMount(as_background)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
