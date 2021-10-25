import {
  recent_visit_first,
  recent_number_first,
  recent_weirdo_first,
  earlier_weirdo_first
} from '@/helpers/sorting'
describe('@/helpers/sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('Methods', () => {
    describe('#recent_number_first', () => {
      it('Puts the larger number first', () => {
        const list = [5596668999, 55966690000]
        list.sort(recent_number_first)
        expect(list[0]).toBe(55966690000)
      })
    })
    describe('#earlier_weirdo_first', () => {
      it('Sorts lists of items or item', () => {
        const list = [
          { id: '/+16282281824/posters/559666932867' },
          [
            { id: '/+16282281824/posters/559666922867' },
            { id: '/+16282281824/posters/559666930000' }
          ]
        ]
        list.sort(earlier_weirdo_first)
        expect(Array.isArray(list[0])).toBe(true)
      })
    })
    describe('#recent_visit_first', () => {
      it('sorts item by recent visit', () => {
        const list = [
          {
            id: '/+14155556666',
            visited: '1230847276509'
          },
          {
            id: '/+16282281824',
            visited: '1630847276509' // more recent
          }
        ]
        list.sort(recent_visit_first)
        expect(list[0].id).toBe('/+14155556666')
      })
    })
    describe('#recent_weirdo_first', () => {
      it('Sorts lists of items or item', () => {
        const list = [
          [
            { id: '/+16282281824/posters/559666922867' },
            { id: '/+16282281824/posters/559666930000' }
          ],
          { id: '/+16282281824/posters/559666932867' }
        ]
        list.sort(recent_weirdo_first)
        expect(Array.isArray(list[0])).toBe(false)
      })
    })
  })
})
