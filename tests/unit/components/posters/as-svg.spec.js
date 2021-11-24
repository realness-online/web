import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/posters/as-svg'
import get_item from '@/use/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
const poster = get_item(poster_html)

describe('@/components/posters/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_svg, {
      props: { itemid: poster.id },
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
  })
  describe('Renders', () => {
    it('A working icon initially', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Can show a poster immediatly', async () => {
      wrapper = await shallowMount(as_svg, {
        props: { itemid: poster.id, immediate: true, poster }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
