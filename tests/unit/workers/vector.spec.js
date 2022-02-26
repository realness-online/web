import { jest } from '@jest/globals'
import * as vector from '@/workers/vector'
import potrace from '@realness.online/potrace'
import Jimp from 'jimp'
const image = require('fs').readFileSync('./tests/unit/workers/house.jpeg')
const poster_html = require('fs').readFileSync(
  './tests/unit/html/poster.html',
  'utf8'
)
const mock_image = {
  bitmap: {
    width: 333,
    height: 444,
    data: [0.3, 0.4, 0.5]
  },
  scan: jest.fn(() => mock_image),
  resize: jest.fn(() => mock_image),
  normalize: jest.fn(() => mock_image),
  threshold: jest.fn(() => mock_image),
  dither565: jest.fn(() => mock_image),
  posterize: jest.fn(() => mock_image),
  contrast: jest.fn(() => mock_image),
  color: jest.fn(() => mock_image)
}
const mock_vector = {
  paths: [poster_html]
}

describe('/workers/vector.js', () => {
  describe('Methods', () => {
    let as_paths_spy
    beforeEach(() => {
      as_paths_spy = jest
        .spyOn(potrace, 'as_paths')
        .mockImplementation(() => Promise.resolve(mock_vector))
    })
    describe('#listen', () => {
      let read_spy
      let postMessage_spy

      beforeEach(() => {
        read_spy = jest
          .spyOn(Jimp, 'read')
          .mockImplementation(() => Promise.resolve(mock_image))
        postMessage_spy = jest
          .spyOn(global, 'postMessage')
          .mockImplementation(() => true)
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
        read_spy.mockImplementationOnce(() => Promise.resolve(wider_image))
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
        as_paths_spy = jest
          .spyOn(potrace, 'as_paths')
          .mockImplementationOnce(() => Promise.resolve(large))
        await vector.make(mock_image)
        expect(mock_image.resize).toBeCalled()
      })
    })
  })
})
