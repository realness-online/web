import { as_poster } from '@/use/vector'
import { ref } from 'vue'
import get_item from '@/modules/item'
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
const poster = get_item(poster_html)

describe('@/use/vector', () => {
  describe('#use_poster', () => {
    describe('.viewbox', () => {
      it("Returns the vector's viewbox", () => {
        // console.log(poster)
        const { viewbox } = as_poster({
          immediate: true,
          slice: false,
          itemid: poster.id,
          poster: poster
        })
        expect(viewbox.value).toBe('0 0 333 444')
      })
      it('Always returns a value', () => {
        const { viewbox, vector } = as_poster({
          immediate: true,
          slice: false,
          itemid: poster.id
        })
        expect(vector.value).toBe(null)
        expect(viewbox.value).toBe('0 0 16 16')
      })
    })
    describe.skip('#show', () => {
      it('Sets vector to the poster prop', async () => {
        wrapper = await shallowMount(as_svg, {
          props: { poster, itemid: poster.id, immediate: true }
        }) // show is called when immediate is true
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.vector.id).toBe(poster.id)
        expect(wrapper.emitted('vector-loaded')).toBeTruthy()
      })
      it('Only loads the vector once', async () => {
        wrapper.vm.vector = poster
        await wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).not.toBeTruthy()
      })
    })
    describe.skip('watch', () => {
      describe('poster', () => {
        it('Updates vector when changed', async () => {
          const other_poster = { ...poster }
          other_poster.id = '/fake_id'
          await wrapper.vm.show()
          await wrapper.setProps({ poster: other_poster })
          expect(wrapper.vm.vector.id).toBe('/fake_id')
        })
        it('Leaves vector alone when poster is null', async () => {
          await wrapper.setProps({ poster })
          expect(wrapper.vm.vector.id).toBe(poster.id)
          await wrapper.setProps({ poster: null })
          expect(wrapper.vm.vector.id).toBe(poster.id)
        })
      })
    })
  })
})
