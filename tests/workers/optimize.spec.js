import * as optimize from '@/workers/optimize'
import SVGO from 'svgo'
const vector = require('fs').readFileSync('./tests/unit/html/vector.html')
describe('/workers/vector.js', () => {
  describe('Methods', () => {
    describe('#listen', () => {
      let optimize_spy
      beforeEach(() => {
        optimize_spy = vi.spyOn(SVGO.prototype, 'optimize')
        // optimize_spy.mockImplementation(() => Promise.resolve(vector))
      })
      it('Optimizes a vector', async () => {
        const postMessage_spy = vi.spyOn(global, 'postMessage')
        postMessage_spy.mockImplementation(() => true)
        await optimize.listen({ data: { vector } })
        expect(optimize_spy).toBeCalled()
        expect(postMessage_spy).toBeCalled()
      })
    })
  })
})
