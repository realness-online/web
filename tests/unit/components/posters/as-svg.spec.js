import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/posters/as-svg'
import { migrate_poster } from '@/use/vector'
import get_item from '@/use/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
let poster = get_item(poster_html)
poster = migrate_poster(poster)
describe('@/components/posters/as-svg.vue', () => {
  describe('Renders', () => {
    it('A working icon initially', () => {
      const wrapper = shallowMount(as_svg, { props: { itemid: poster.id } })
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Can show a poster immediatly', async () => {
      const wrapper = await shallowMount(as_svg, {
        props: { itemid: poster.id, immediate: true, poster }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
