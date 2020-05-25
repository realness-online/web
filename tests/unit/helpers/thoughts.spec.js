import { as_thoughts } from '@/helpers/thoughts'
import { get_item } from '@/modules/item'
const fs = require('fs')

const statements_html = fs.readFileSync('./tests/unit/html/statements.html', 'utf8')
describe('@/helpers/itemid', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('exports', () => {
    let person
    beforeEach(() => {
      person = get_item(statements_html)
    })
    describe('#as_thoughts', () => {
      it('exists', () => {
        expect(as_thoughts).toBeDefined()
      })
      it('returns 3 thoughts', () => {
        const thoughts = as_thoughts(person.statements)
        expect(thoughts.length).toBe(3)
      })
    })
  })
})
