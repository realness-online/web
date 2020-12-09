import {
  newer_number_first,
  newer_weirdo_first
} from '@/helpers/sorting'
describe('@/helpers/sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('#newer_number_first', () => {
    it('puts the larger number first', () => {
      const list = [449666932867, 559666932867]
      list.sort(newer_number_first)
      expect(list[0]).toBe(559666932867)
    })
  })
  describe('#newer_weirdo_first', () => {
    it('sorts lists of items or items', () => {
      const list = [
        { id: '/+16282281824/posters/559666932867' },
        [
          { id: '/+16282281824/posters/559666922867' },
          { id: '/+16282281824/posters/559666933867' }
        ]
      ]
      list.sort(newer_weirdo_first)
      expect(Array.isArray(list[0])).toBe(true)
    })
  })
})
