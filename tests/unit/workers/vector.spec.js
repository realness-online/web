import * as vector from '@/workers/vector'
import * as potrace from '@realness.online/potrace'
const image = require('fs').readFileSync('./tests/unit/workers/house.jpeg')
const poster_html = require('fs').readFileSync('./tests/unit/html/poster.html', 'utf8')
const mock_image = {
  bitmap: {
    width: 333,
    height: 444
  },
  resize: jest.fn(_ => mock_image),
  normalize: jest.fn(_ => mock_image),
  threshold: jest.fn(_ => mock_image),
  dither565: jest.fn(_ => mock_image),
  posterize: jest.fn(_ => mock_image),
  contrast: jest.fn(_ => mock_image),
  color: jest.fn(_ => mock_image)
}
const mock_vector = {
  paths: [poster_html]
}

describe('/workers/vector.js', () => {
  describe('Methods', () => {
    let as_paths_spy
    beforeEach(() => {
      as_paths_spy = jest.spyOn(potrace, 'as_paths')
      .mockImplementation(_ => Promise.resolve(mock_vector))
    })
    describe('#listen', () => {
      let read_spy
      let postMessage_spy

      beforeEach(() => {
        read_spy = jest.spyOn(potrace.Jimp, 'read')
        .mockImplementation(_ => Promise.resolve(mock_image))
        postMessage_spy = jest.spyOn(global, 'postMessage')
        .mockImplementation(_ => true)
      })
      it('Creates a vector from a jpeg', async () => {
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
    describe('#make', () => {
      it('Handles large vectors', async () => {
        const large = {
          paths: []
        }
        for (let i = 0; i < 100; i++) {
          large.paths.push(image)
        }
        large.paths.push(image)
        as_paths_spy = jest.spyOn(potrace, 'as_paths')
        .mockImplementationOnce(_ => Promise.resolve(large))
        await vector.make(mock_image)
        expect(mock_image.resize).toBeCalled()
      })
    })
  })
})
