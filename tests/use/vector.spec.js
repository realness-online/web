import { use_poster } from '@/use/vector'
import get_item from '@/use/item'
const poster_html = read_mock_file('@@/html/poster.html')
const poster = get_item(poster_html)

describe('@/use/vector', () => {
  describe('#use_poster', () => {
    describe('.viewbox', () => {
      it('Returns the vector\'s viewbox', () => {
        const { viewbox } = use_poster({
          immediate: true,
          slice: false,
          itemid: poster.id,
          poster
        })
        expect(viewbox.value).toBe('0 0 333 444')
      })
      it('Always returns a value', () => {
        const { viewbox, vector } = use_poster({
          immediate: true,
          slice: false,
          itemid: poster.id
        })
        expect(vector.value).toBe(null)
        expect(viewbox.value).toBe('0 0 16 16')
      })
    })
    describe('#show', () => {
      it('Sets vector to the poster prop', async () => {
        const emit = vi.fn()
        const props = {
          poster,
          immediate: true,
          slice: false,
          itemid: poster.id
        }
        const { vector, show } = use_poster(props, emit)
        await show()
        expect(vector.value.id).toBe(poster.id)
        expect(emit).toBeCalledWith('loaded', vector.value)
      })
      it('Only loads the vector once', async () => {
        const emit = vi.fn()
        const props = {
          immediate: true,
          itemid: poster.id
        }
        const { show } = use_poster(props, emit)
        await show()
        expect(emit).not.toBeCalledWith()
      })
    })
  })
})
