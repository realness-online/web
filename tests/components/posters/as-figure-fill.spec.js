import { shallowMount } from '@vue/test-utils'
import as_fill_figure from '@/components/posters/as-figure-fill'
import get_item from '@/use/item'
import fs from 'fs'
const poster_html = fs.readFileSync(
  './__mocks__/html/poster.html',
  'utf8'
)
let poster = get_item(poster_html)
const itemid = '/+16282281824/posters/559666932867'
describe('@/components/posters/as-fill-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_fill_figure, {
      props: { poster, itemid }
    })
  })
  describe('Renders', () => {
    it('a editor for a poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe.skip('Methods', () => {
    describe('#focus_on_active', () => {
      it('sets the focus on the active element', () => {
        wrapper.vm.focus_on_active()
      })
    })
    describe('#focus_on_active', () => {
      it('sets the color of active element', () => {
        wrapper.vm.set_input_color('bold')
      })
    })
  })
})
