import * as vector from '@/workers/vector'
describe('/workers/vector.js', () => {
  describe('methods', () => {
    describe('#message_listener', () => {
      it('Exists', () => {
        expect(vector.message_listener).toBeDefined()
      })
    })
  })
})
