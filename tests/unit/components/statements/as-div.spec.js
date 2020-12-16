import { shallowMount } from '@vue/test-utils'
import flushPromises from 'flush-promises'
import as_statement from '@/components/statements/as-div'
import get_item from '@/modules/item'
import { Statements } from '@/persistance/Storage'
const statements_as_html = require('fs').readFileSync('./tests/unit/html/statements.html', 'utf8')
describe('@/components/statements/as-div.vue', () => {
  let wrapper
  const statements = get_item(statements_as_html)
  beforeEach(() => {
    wrapper = shallowMount(as_statement, { propsData: { statement: statements.statements[0] } })
  })
  describe('rendering:', () => {
    it('Render a statement', async () => {
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      wrapper.destroy()
    })
  })
  describe('methods', () => {
    describe('#save', () => {
      it('Saves a statement', async () => {
        wrapper = shallowMount(as_statement, {
           propsData: {
             editable: true,
             statement: statements.statements[0]
           }
        })
        jest.spyOn(Statements.prototype, 'save').mockImplementation(_ => {
          return jest.fn(() => Promise.resolve())
        })
        wrapper.vm.$refs.editable.textContent = 'changed'
        await wrapper.vm.save()
        expect(Statements.prototype.save).toBeCalled()
      })
      it('Doe nothing if the statement is the same', async () => {
        wrapper = shallowMount(as_statement, {
           propsData: {
             editable: true,
             statement: statements.statements[0]
           }
        })
        jest.spyOn(Statements.prototype, 'save').mockImplementation(_ => {
          return jest.fn(() => Promise.resolve())
        })
        await wrapper.vm.save()
        expect(Statements.prototype.save).not.toBeCalled()
      })
    })
    describe('#focused', () => {
      it('Emits an event', () => {
        wrapper.vm.focused()
        expect(wrapper.emitted('focused')).toBeTruthy()
      })
    })
  })
})
