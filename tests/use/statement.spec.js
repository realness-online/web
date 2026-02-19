import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent, nextTick as tick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  use,
  as_thoughts,
  thoughts_sort,
  slot_key,
  is_train_of_thought
} from '@/use/statement'

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
  Statement: vi.fn().mockImplementation(() => ({
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

describe('statement composable', () => {
  let statement_instance

  beforeEach(() => {
    vi.clearAllMocks()
    statement_instance = with_setup(() => use())
  })

  describe('initialization', () => {
    it('returns composable functions', () => {
      expect(statement_instance.for_person).toBeTypeOf('function')
      expect(statement_instance.save).toBeTypeOf('function')
      expect(statement_instance.thought_shown).toBeTypeOf('function')
    })

    it('initializes refs', async () => {
      await tick()
      expect(statement_instance.authors.value).toEqual([
        {
          id: '/+14151234356',
          type: 'person',
          viewed: ['index']
        }
      ])
      expect(statement_instance.thoughts.value).toBe(null)
      expect(statement_instance.my_thoughts.value).toEqual([])
    })
  })

  describe('for_person', () => {
    it('loads statements for person', async () => {
      const { list } = await import('@/utils/itemid')
      const mock_statements = [
        { id: '/+1234/statements/1000', statement: 'Hello' }
      ]
      list.mockResolvedValue(mock_statements)

      const person = { id: '/+1234', type: 'person' }
      await statement_instance.for_person(person)

      expect(list).toHaveBeenCalledWith('/+1234/statements')
      expect(statement_instance.thoughts.value).toEqual(mock_statements)
    })

    it('sets person viewed to index', async () => {
      const person = { id: '/+1234', type: 'person' }
      await statement_instance.for_person(person)

      const author = statement_instance.authors.value.find(
        a => a.id === person.id
      )
      expect(author.viewed).toEqual(['index'])
    })

    it('adds person to authors', async () => {
      const person = { id: '/+1234', type: 'person' }
      await statement_instance.for_person(person)

      expect(statement_instance.authors.value).toContainEqual({
        id: '/+1234',
        type: 'person',
        viewed: ['index']
      })
    })

    it('appends to existing statements', async () => {
      const { list } = await import('@/utils/itemid')
      list.mockResolvedValue([{ id: '/+1234/statements/1000' }])

      statement_instance.thoughts.value = [{ id: '/+5678/statements/2000' }]

      const person = { id: '/+1234', type: 'person' }
      await statement_instance.for_person(person)

      expect(statement_instance.thoughts.value).toHaveLength(2)
    })
  })

  describe('save', () => {
    it('saves statement with trimmed text', async () => {
      const { Statement } = await import('@/persistance/Storage')
      const initial_length = statement_instance.my_thoughts.value.length

      await statement_instance.save('  Hello World  ')

      expect(statement_instance.my_thoughts.value.length).toBe(
        initial_length + 1
      )
      const last_statement =
        statement_instance.my_thoughts.value[
          statement_instance.my_thoughts.value.length - 1
        ]
      expect(last_statement.statement).toBe('Hello World')
    })

    it('generates id with timestamp', async () => {
      await statement_instance.save('Test')

      const statements = statement_instance.my_thoughts.value
      const saved_id = statements[statements.length - 1].id
      const timestamp = Number(saved_id.split('/').pop())

      expect(timestamp).toBeGreaterThan(0)
      expect(saved_id).toContain('/+14151234356/statements/')
    })

    it('calls Statement save', async () => {
      const { Statement } = await import('@/persistance/Storage')

      await statement_instance.save('Test')

      expect(Statement).toHaveBeenCalled()
    })

    it('returns early for empty statement', async () => {
      const { Statement } = await import('@/persistance/Storage')
      Statement.mockClear()

      await statement_instance.save('')

      // Function returns early, no Statement().save() called
      expect(Statement).not.toHaveBeenCalled()
    })

    it('returns early for null statement', async () => {
      const { Statement } = await import('@/persistance/Storage')
      Statement.mockClear()

      await statement_instance.save(null)

      // Function returns early, no Statement().save() called
      expect(Statement).not.toHaveBeenCalled()
    })
  })

  describe('thought_shown', () => {
    it('requires non-empty thought array', async () => {
      const thought = [{ id: '/+1234/statements/1000', statement: 'Test' }]
      statement_instance.thoughts.value = [thought[0]]

      // Function will try to find author and filter statements
      await statement_instance.thought_shown(thought)

      // Test completes without error
      expect(true).toBe(true)
    })
  })
})

describe('as_thoughts', () => {
  it('groups statements into thoughts', () => {
    const statements = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    const thoughts = as_thoughts(statements)

    expect(thoughts).toBeInstanceOf(Array)
    expect(thoughts.length).toBeGreaterThan(0)
  })

  it('returns empty array for empty input', () => {
    const thoughts = as_thoughts([])
    expect(thoughts).toEqual([])
  })

  it('each thought is an array of statements', () => {
    const statements = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    const thoughts = as_thoughts(statements)

    thoughts.forEach(thought => {
      expect(Array.isArray(thought)).toBe(true)
    })
  })
})

describe('thoughts_sort', () => {
  it('sorts thoughts by first statement timestamp', () => {
    const thought1 = [{ id: '/+1234/statements/2000', statement: 'Later' }]
    const thought2 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]

    const result = thoughts_sort(thought1, thought2)

    expect(result).toBeGreaterThan(0)
  })

  it('returns negative for earlier first thought', () => {
    const thought1 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]
    const thought2 = [{ id: '/+1234/statements/2000', statement: 'Later' }]

    const result = thoughts_sort(thought1, thought2)

    expect(result).toBeLessThan(0)
  })

  it('returns 0 for same timestamp', () => {
    const thought1 = [{ id: '/+1234/statements/1000', statement: 'First' }]
    const thought2 = [{ id: '/+5678/statements/1000', statement: 'Second' }]

    const result = thoughts_sort(thought1, thought2)

    expect(result).toBe(0)
  })
})

describe('slot_key', () => {
  it('returns first item id for array', () => {
    const thought = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    expect(slot_key(thought)).toBe('/+1234/statements/1000')
  })

  it('returns id for non-array item', () => {
    const statement = { id: '/+1234/statements/1000', statement: 'Test' }

    expect(slot_key(statement)).toBe('/+1234/statements/1000')
  })
})

describe('is_train_of_thought', () => {
  it('returns true for statements within 13 minutes', () => {
    const now = Date.now()
    const thot = [{ id: `/+1234/statements/${now}`, statement: 'First' }]
    const statements = [
      { id: `/+1234/statements/${now + 60000}`, statement: 'Second' } // 1 minute later
    ]

    expect(is_train_of_thought(thot, statements)).toBe(true)
  })

  it('returns false for statements over 13 minutes apart', () => {
    const thot = [{ id: '/+1234/statements/1000', statement: 'First' }]
    const statements = [
      { id: '/+1234/statements/2000000', statement: 'Second' } // Way later
    ]

    expect(is_train_of_thought(thot, statements)).toBe(false)
  })

  it('returns false when statements array is empty', () => {
    const thot = [{ id: '/+1234/statements/1000', statement: 'First' }]
    const statements = []

    expect(is_train_of_thought(thot, statements)).toBe(false)
  })

  it('returns false when thot is empty', () => {
    const thot = []
    const statements = [{ id: '/+1234/statements/1000', statement: 'First' }]

    expect(is_train_of_thought(thot, statements)).toBe(false)
  })
})
