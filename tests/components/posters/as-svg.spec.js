import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/posters/as-svg'
import get_item from '@/utils/item'

const poster_html = read_mock_file('@@/html/poster.html')
const poster = get_item(poster_html)
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
