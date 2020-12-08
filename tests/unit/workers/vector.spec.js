import * as vector from '@/workers/vector'
import * as potrace from '@realness.online/potrace'
const image = require('fs').readFileSync('./tests/unit/workers/house.jpeg')
const mock_image = {
  bitmap: {
    width: 333,
    height: 444
  },
  resize: jest.fn(_ => mock_image),
  normalize: jest.fn(_ => mock_image),
  threshold: jest.fn(_ => mock_image)
}
const mock_vector = {}

describe('/workers/vector.js', () => {
  describe('methods', () => {
    describe('#listen', () => {
      let read_spy
      let as_paths_spy
      let postMessage_spy
      beforeEach(() => {
        read_spy = jest.spyOn(potrace.Jimp, 'read')
        read_spy.mockImplementation(_ => Promise.resolve(mock_image))
        as_paths_spy = jest.spyOn(potrace, 'as_paths')
        as_paths_spy.mockImplementation(_ => Promise.resolve(mock_vector))
        postMessage_spy = jest.spyOn(global, 'postMessage')
        postMessage_spy.mockImplementation(_ => true)
      })
      it('#Creates a vector from a jpeg', async () => {
        await vector.listen({ data: { image } })
        expect(read_spy).toBeCalled()
        expect(as_paths_spy).toBeCalled()
        expect(postMessage_spy).toBeCalled()
      })
      it('Can handle different aspect ratios', async () => {
        const wider_image = { ...mock_image }
        wider_image.bitmap.width = 666
        read_spy.mockImplementationOnce(_ => Promise.resolve(wider_image))
        await vector.listen({ data: { image } })
        expect(read_spy).toBeCalled()
        expect(as_paths_spy).toBeCalled()
        expect(postMessage_spy).toBeCalled()
      })
    })
  })
})
