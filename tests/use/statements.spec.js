import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Statements from '@/use/statement'

const STATEMENT_COUNT = 3
const MOCK_ITEM_ID = 'test-123'

describe('@/use/statement', () => {
  let wrapper
  let load_spy

  beforeEach(() => {
    load_spy = vi.fn()
    wrapper = shallowMount(Statements, {
      global: {
        mocks: {
          load_statements: load_spy
        }
      }
    })
  })

  describe('Basic Functionality', () => {
    it('initializes with empty statements', () => {
      expect(wrapper.vm.statements).toEqual([])
    })

    it('adds new statements', () => {
      const test_statements = Array(STATEMENT_COUNT)
        .fill()
        .map((_, i) => ({
          id: i,
          content: `Statement ${i}`
        }))

      test_statements.forEach(statement => {
        wrapper.vm.add_statement(statement)
      })

      expect(wrapper.vm.statements.length).toBe(STATEMENT_COUNT)
    })
  })

  describe('Statement Loading', () => {
    it('loads statements for an item', async () => {
      await wrapper.vm.load_statements(MOCK_ITEM_ID)
      expect(load_spy).toHaveBeenCalledWith(MOCK_ITEM_ID)
    })

    it('handles loading errors gracefully', async () => {
      load_spy.mockRejectedValueOnce(new Error('Load failed'))
      await wrapper.vm.load_statements(MOCK_ITEM_ID)
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Statement Management', () => {
    it('removes statements', () => {
      const statement = { id: 1, content: 'Test' }
      wrapper.vm.add_statement(statement)
      wrapper.vm.remove_statement(statement)
      expect(wrapper.vm.statements).not.toContain(statement)
    })

    it('updates existing statements', () => {
      const statement = { id: 1, content: 'Original' }
      const updated = { id: 1, content: 'Updated' }
      wrapper.vm.add_statement(statement)
      wrapper.vm.update_statement(updated)
      expect(wrapper.vm.statements[0].content).toBe('Updated')
    })
  })

  describe('Statement Validation', () => {
    it('validates statement content', () => {
      const invalid_statement = { id: 1, content: '' }
      expect(wrapper.vm.validate_statement(invalid_statement)).toBe(false)
    })

    it('prevents duplicate statements', () => {
      const statement = { id: 1, content: 'Test' }
      wrapper.vm.add_statement(statement)
      expect(wrapper.vm.can_add_statement(statement)).toBe(false)
    })
  })
})
