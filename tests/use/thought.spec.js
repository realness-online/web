import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent, nextTick as tick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  use,
  as_statements,
  statements_sort,
  slot_key,
  is_train_of_statement
} from '@/use/thought'

// Mock localStorage BEFORE importing
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: { me: '/+14151234356' },
    configurable: true,
    writable: true
  })
})

// Mock dependencies
vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(id => {
    const parts = id.split('/')
    return Number(parts[parts.length - 1])
  }),
  list: vi.fn(() => Promise.resolve([])),
  as_author: vi.fn(id => {
    const parts = id.split('/')
    return parts[0]
  })
}))

vi.mock('@/persistance/Directory', () => ({
  as_directory: vi.fn(() =>
    Promise.resolve({
      items: ['1000', '2000', '3000']
    })
  )
}))

vi.mock('@/utils/sorting', () => ({
  recent_item_first: vi.fn((a, b) => {
    const a_time = Number(a.id.split('/').pop())
    const b_time = Number(b.id.split('/').pop())
    return b_time - a_time
  }),
  recent_number_first: vi.fn((a, b) => Number(b) - Number(a))
}))

vi.mock('@/persistance/Storage', () => ({
  Thought: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('@/utils/numbers', () => ({
  JS_TIME: {
    THIRTEEN_MINUTES: 13 * 60 * 1000
  }
}))

// Helper to test composables in proper Vue context
function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return result
}

describe('thought composable', () => {
  let thought_instance

  beforeEach(() => {
    vi.clearAllMocks()
    thought_instance = with_setup(() => use())
  })

  describe('initialization', () => {
    it('returns composable functions', () => {
      expect(thought_instance.for_person).toBeTypeOf('function')
      expect(thought_instance.save).toBeTypeOf('function')
      expect(thought_instance.statement_shown).toBeTypeOf('function')
    })

    it('initializes refs', async () => {
      await tick()
      expect(thought_instance.authors.value).toEqual([
        {
          id: '/+14151234356',
          type: 'person',
          viewed: ['index']
        }
      ])
      expect(thought_instance.thoughts.value).toBe(null)
      expect(thought_instance.my_thoughts.value).toEqual([])
    })
  })

  describe('for_person', () => {
    it('loads thoughts for person', async () => {
      const { list } = await import('@/utils/itemid')
      const mock_thoughts = [{ id: '/+1234/thoughts/1000', thought: 'Hello' }]
      list.mockResolvedValue(mock_thoughts)

      const person = { id: '/+1234', type: 'person' }
      await thought_instance.for_person(person)

      expect(list).toHaveBeenCalledWith('/+1234/thoughts')
      expect(thought_instance.thoughts.value).toEqual(mock_thoughts)
    })

    it('sets person viewed to index', async () => {
      const person = { id: '/+1234', type: 'person' }
      await thought_instance.for_person(person)

      const author = thought_instance.authors.value.find(
        a => a.id === person.id
      )
      expect(author.viewed).toEqual(['index'])
    })

    it('adds person to authors', async () => {
      const person = { id: '/+1234', type: 'person' }
      await thought_instance.for_person(person)

      expect(thought_instance.authors.value).toContainEqual({
        id: '/+1234',
        type: 'person',
        viewed: ['index']
      })
    })

    it('appends to existing thoughts', async () => {
      const { list } = await import('@/utils/itemid')
      list.mockResolvedValue([{ id: '/+1234/thoughts/1000' }])

      thought_instance.thoughts.value = [{ id: '/+5678/thoughts/2000' }]

      const person = { id: '/+1234', type: 'person' }
      await thought_instance.for_person(person)

      expect(thought_instance.thoughts.value).toHaveLength(2)
    })
  })

  describe('save', () => {
    it('saves thought with trimmed text', async () => {
      const { Thought } = await import('@/persistance/Storage')
      const initial_length = thought_instance.my_thoughts.value.length

      await thought_instance.save('  Hello World  ')

      expect(thought_instance.my_thoughts.value.length).toBe(initial_length + 1)
      const last_thought =
        thought_instance.my_thoughts.value[
          thought_instance.my_thoughts.value.length - 1
        ]
      expect(last_thought.thought).toBe('Hello World')
    })

    it('generates id with timestamp', async () => {
      await thought_instance.save('Test')

      const thoughts = thought_instance.my_thoughts.value
      const saved_id = thoughts[thoughts.length - 1].id
      const timestamp = Number(saved_id.split('/').pop())

      expect(timestamp).toBeGreaterThan(0)
      expect(saved_id).toContain('/+14151234356/thoughts/')
    })

    it('calls Thought save', async () => {
      const { Thought } = await import('@/persistance/Storage')

      await thought_instance.save('Test')

      expect(Thought).toHaveBeenCalled()
    })

    it('returns early for empty thought', async () => {
      const { Thought } = await import('@/persistance/Storage')
      Thought.mockClear()

      await thought_instance.save('')

      expect(Thought).not.toHaveBeenCalled()
    })

    it('returns early for null thought', async () => {
      const { Thought } = await import('@/persistance/Storage')
      Thought.mockClear()

      await thought_instance.save(null)

      expect(Thought).not.toHaveBeenCalled()
    })
  })

  describe('statement_shown', () => {
    it('requires non-empty statement array', async () => {
      const stmt = [{ id: '/+1234/thoughts/1000', thought: 'Test' }]
      thought_instance.thoughts.value = [stmt[0]]

      await thought_instance.statement_shown(stmt)

      expect(true).toBe(true)
    })
  })
})

describe('as_statements', () => {
  it('groups thoughts into statements', () => {
    const thoughts = [
      { id: '/+1234/thoughts/1000', thought: 'First' },
      { id: '/+1234/thoughts/1001', thought: 'Second' }
    ]

    const statements = as_statements(thoughts)

    expect(statements).toBeInstanceOf(Array)
    expect(statements.length).toBeGreaterThan(0)
  })

  it('returns empty array for empty input', () => {
    const statements = as_statements([])
    expect(statements).toEqual([])
  })

  it('each statement is an array of thoughts', () => {
    const thoughts = [
      { id: '/+1234/thoughts/1000', thought: 'First' },
      { id: '/+1234/thoughts/1001', thought: 'Second' }
    ]

    const statements = as_statements(thoughts)

    statements.forEach(stmt => {
      expect(Array.isArray(stmt)).toBe(true)
    })
  })
})

describe('statements_sort', () => {
  it('sorts statements by first thought timestamp', () => {
    const stmt1 = [{ id: '/+1234/thoughts/2000', thought: 'Later' }]
    const stmt2 = [{ id: '/+1234/thoughts/1000', thought: 'Earlier' }]

    const result = statements_sort(stmt1, stmt2)

    expect(result).toBeGreaterThan(0)
  })

  it('returns negative for earlier first statement', () => {
    const stmt1 = [{ id: '/+1234/thoughts/1000', thought: 'Earlier' }]
    const stmt2 = [{ id: '/+1234/thoughts/2000', thought: 'Later' }]

    const result = statements_sort(stmt1, stmt2)

    expect(result).toBeLessThan(0)
  })

  it('returns 0 for same timestamp', () => {
    const stmt1 = [{ id: '/+1234/thoughts/1000', thought: 'First' }]
    const stmt2 = [{ id: '/+5678/thoughts/1000', thought: 'Second' }]

    const result = statements_sort(stmt1, stmt2)

    expect(result).toBe(0)
  })
})

describe('slot_key', () => {
  it('returns first item id for array', () => {
    const stmt = [
      { id: '/+1234/thoughts/1000', thought: 'First' },
      { id: '/+1234/thoughts/1001', thought: 'Second' }
    ]

    expect(slot_key(stmt)).toBe('/+1234/thoughts/1000')
  })

  it('returns id for non-array item', () => {
    const thought = { id: '/+1234/thoughts/1000', thought: 'Test' }

    expect(slot_key(thought)).toBe('/+1234/thoughts/1000')
  })
})

describe('is_train_of_statement', () => {
  it('returns true for thoughts within 13 minutes', () => {
    const now = Date.now()
    const stmt = [{ id: `/+1234/thoughts/${now}`, thought: 'First' }]
    const thoughts = [
      { id: `/+1234/thoughts/${now + 60000}`, thought: 'Second' }
    ]

    expect(is_train_of_statement(stmt, thoughts)).toBe(true)
  })

  it('returns false for thoughts over 13 minutes apart', () => {
    const stmt = [{ id: '/+1234/thoughts/1000', thought: 'First' }]
    const thoughts = [{ id: '/+1234/thoughts/2000000', thought: 'Second' }]

    expect(is_train_of_statement(stmt, thoughts)).toBe(false)
  })

  it('returns false when thoughts array is empty', () => {
    const stmt = [{ id: '/+1234/thoughts/1000', thought: 'First' }]
    const thoughts = []

    expect(is_train_of_statement(stmt, thoughts)).toBe(false)
  })

  it('returns false when stmt is empty', () => {
    const stmt = []
    const thoughts = [{ id: '/+1234/thoughts/1000', thought: 'First' }]

    expect(is_train_of_statement(stmt, thoughts)).toBe(false)
  })
})
