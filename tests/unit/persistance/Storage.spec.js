import Storage, { Me } from '@/persistance/Storage'

describe('@/persistance/Storage.js', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  describe('Classes', () => {
    describe('Storage', () => {
      it('Sets id from itemid', () => {
        const human = new Storage('/scott/fryxell')
        expect(human.id).toBe('/scott/fryxell')
      })
      it('Has metadata', () => {
        const human = new Storage('/scott/fryxell')
        expect(human.metadata.contentType).toBe('text/html')
      })
    })
    describe('Me', () => {
      it('Gets me from local storage', () => {
        localStorage.setItem('me', '/+16282281824')
        expect(new Me().id).toBe('/+16282281824')
      })
    })
  })
})
