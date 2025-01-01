import { as_thoughts } from '@/use/statements'
import { get_item } from '@/use/item'
const statements_html = read_mock_file('@@/html/statements.html')
describe('@/use/statements', () => {
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
    describe('#thought_shown', () => {
      const statements = [
        { id: '/+16282281824/statements/1569168047725' },
        { id: '/+16282281824/statements/1569909292018' },
        { id: '/+16282281824/statements/1569909311638' }
      ]
      it("Checks if it's time to load more thoughts", async () => {
        vi.spyOn(itemid, 'as_directory').mockImplementation(() => {
          return { items: ['index', '1569909311638'] }
        })
        wrapper.vm.statements = statements
        await wrapper.vm.thought_shown(statements)
      })
    })
    describe('#slot_key', () => {
      const item = { id: '/+16282281824/statements/1569168047725' }
      it('Determines the slot key of an item', () => {
        const key = wrapper.vm.slot_key(item)
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
      it('Determines the slot key of an array of items', () => {
        const key = wrapper.vm.slot_key([item])
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
    })
    describe('#use', () => {
      it('Handles empty person', () => {
        load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        wrapper.vm.get_all_my_stuff()
        expect(load_spy).toBeCalled()
      })
    })
  })
})
