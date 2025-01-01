import { shallowMount } from '@vue/test-utils'
import as_path from '@/components/posters/as-path'
import get_item from '@/use/item'

const poster_html = read_mock_file('@@/html/poster.html')
const poster = get_item(poster_html)
describe('@/components/posters/as-fill-figure.vue', () => {
  describe('Renders', () => {
    it('a path from one provided', () => {
      const wrapper = shallowMount(as_path, {
        props: { path: poster.bold }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})
