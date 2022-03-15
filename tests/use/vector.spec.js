import { as_poster } from '@/use/vector'

import get_item from '@/use/item'
import fs from 'fs'
const poster_html = fs.readFileSync('./__mocks__/html/poster.html', 'utf8')
const poster = get_item(poster_html)

describe('@/use/vector', () => {
  describe('#use_poster', () => {
    describe('.viewbox', () => {
      it("Returns the vector's viewbox", () => {
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
    describe('#show', () => {
      it('Sets vector to the poster prop', async () => {
        const emit = vi.fn()
        const props = {
          poster,
          immediate: true,
          slice: false,
          itemid: poster.id
        }
        const { vector, show } = as_poster(props, emit)
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
        const { show } = as_poster(props, emit)
        await show()
        expect(emit).not.toBeCalledWith()
      })
    })
  })
})
