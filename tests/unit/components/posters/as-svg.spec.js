import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/posters/as-svg'
import get_item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)

describe('@/components/posters/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_svg, {
      propsData: { itemid: poster.id }
    })
  })
  describe('Rendering', () => {
    it('a poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('can show a poster immediatly', () => {
      wrapper = shallowMount(as_svg, {
        propsData: { itemid: poster.id, immediate: true }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('computed:', () => {
    describe('viewbox', () => {
      it('Returns the vector\'s viewbox', () => {
        wrapper.vm.vector = poster
        expect(wrapper.vm.viewbox).toBe('0 0 333 444')
      })
      it('Always returns a value', () => {
        expect(wrapper.vm.vector).toBe(null)
        expect(wrapper.vm.viewbox).toBe('0 0 0 0')
      })
    })
  })
  describe('methods', () => {
    describe('#show', () => {
      it('Sets vector to the poster prop', () => {
        wrapper = shallowMount(as_svg, {
          propsData: { poster, itemid: poster.id, immediate: true }
        })
        wrapper.vm.show()
        expect(wrapper.vm.vector.id).toBe(poster.id)
        expect(wrapper.emitted('vector-loaded')).toBeTruthy()
      })
      it('Only loads the vector once', () => {
        wrapper.vm.vector = poster
        wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).not.toBeTruthy()
      })
    })
  })
})
