import { as_thoughts } from '@/use/thoughts'
import { get_item } from '@/use/item'
const fs = require('fs')

const statements_html = fs.readFileSync(
  './tests/unit/html/statements.html',
  'utf8'
)
describe('@/use/itemid', () => {
  describe('Methods', () => {
    let person
    beforeEach(() => {
      person = get_item(statements_html)
    })
    describe('#as_thoughts', () => {
      it('Exists', () => {
        expect(as_thoughts).toBeDefined()
      })
      it('Returns three thoughts', () => {
        const thoughts = as_thoughts(person.statements)
        expect(thoughts.length).toBe(3)
      })
    })
  })
})
