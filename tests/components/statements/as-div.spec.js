import { shallowMount, flushPromises } from '@vue/test-utils'
import as_statement from '@/components/statements/as-div'
import get_item from '@/use/item'
import { Statements } from '@/persistance/Storage'
import fs from 'fs'

const statements_as_html = read_mock_file('@@/html/statements.html')

describe('@/components/statements/as-div.vue', () => {
  let wrapper
  const statements = get_item(statements_as_html)

  beforeEach(() => {
    wrapper = shallowMount(as_statement, {
      props: { statement: statements.statements[0] }
    })
  })

  describe('Renders', () => {
    it('A statement', async () => {
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      wrapper.unmount()
    })
  })

  describe('Methods', () => {
    describe('#save', () => {
      it('Saves a statement', async () => {
        wrapper = shallowMount(as_statement, {
          props: {
            editable: true,
            statement: statements.statements[0]
          }
        })
        vi.spyOn(Statements.prototype, 'save').mockImplementation(() => vi.fn(() => Promise.resolve()))
        wrapper.vm.$refs.editable.textContent = 'changed'
        await wrapper.vm.save()
        expect(Statements.prototype.save).toBeCalled()
      })
      it('Doe nothing if the statement is the same', async () => {
        wrapper = shallowMount(as_statement, {
          props: {
            editable: true,
            statement: statements.statements[0]
          }
        })
        vi.spyOn(Statements.prototype, 'save').mockImplementation(() => vi.fn(() => Promise.resolve()))
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
