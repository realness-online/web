import * as vector from '@/workers/vector'
describe('/workers/vector.js', () => {
  describe('methods', () => {
    it('#read', () => {
      vector.read()
    })
    it('#prepare', () => {
      vector.prepare()
    })
    it('#make', () => {
      vector.make()
    })
    it('#listen', () => {
      vector.listen()
    })
  })
})
