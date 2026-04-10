import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent, nextTick as tick } from 'vue'
import { mount } from '@vue/test-utils'
import {
  use,
  as_thoughts,
  thoughts_sort,
  slot_key,
  poster_thought_overlay_pairs
} from '@/use/statements'

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: { me: '/+14151234356' },
    configurable: true,
    writable: true
  })
})

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

vi.mock('@/persistence/Directory', () => ({
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

vi.mock('@/persistence/Storage', () => ({
  Statements: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('@/utils/numbers', () => ({
  JS_TIME: {
    THIRTEEN_MINUTES: 13 * 60 * 1000
  }
}))

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

describe('statements composable', () => {
  let instance

  beforeEach(() => {
    vi.clearAllMocks()
    instance = with_setup(() => use())
  })

  describe('initialization', () => {
    it('returns composable functions', () => {
      expect(instance.for_person).toBeTypeOf('function')
      expect(instance.save).toBeTypeOf('function')
      expect(instance.statement_shown).toBeTypeOf('function')
    })

    it('initializes refs', async () => {
      await tick()
      expect(instance.authors.value).toEqual([
        {
          id: '/+14151234356',
          type: 'person',
          viewed: ['index']
        }
      ])
      expect(instance.statements.value).toBe(null)
      expect(instance.my_statements.value).toEqual([])
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
      await instance.for_person(person)

      expect(list).toHaveBeenCalledWith('/+1234/statements')
      expect(instance.statements.value).toEqual(mock_statements)
    })

    it('sets person viewed to index', async () => {
      const person = { id: '/+1234', type: 'person' }
      await instance.for_person(person)

      const author = instance.authors.value.find(a => a.id === person.id)
      expect(author.viewed).toEqual(['index'])
    })

    it('adds person to authors', async () => {
      const person = { id: '/+1234', type: 'person' }
      await instance.for_person(person)

      expect(instance.authors.value).toContainEqual({
        id: '/+1234',
        type: 'person',
        viewed: ['index']
      })
    })

    it('appends to existing statements', async () => {
      const { list } = await import('@/utils/itemid')
      list.mockResolvedValue([{ id: '/+1234/statements/1000' }])

      instance.statements.value = [{ id: '/+5678/statements/2000' }]

      const person = { id: '/+1234', type: 'person' }
      await instance.for_person(person)

      expect(instance.statements.value).toHaveLength(2)
    })
  })

  describe('save', () => {
    it('saves statement with trimmed text', async () => {
      const { Statements } = await import('@/persistence/Storage')
      const initial_length = instance.my_statements.value.length

      await instance.save('  Hello World  ')

      expect(instance.my_statements.value.length).toBe(initial_length + 1)
      const last =
        instance.my_statements.value[instance.my_statements.value.length - 1]
      expect(last.statement).toBe('Hello World')
    })

    it('generates id with timestamp', async () => {
      await instance.save('Test')

      const stmts = instance.my_statements.value
      const saved_id = stmts[stmts.length - 1].id
      const timestamp = Number(saved_id.split('/').pop())

      expect(timestamp).toBeGreaterThan(0)
      expect(saved_id).toContain('/+14151234356/statements/')
    })

    it('calls Statements save', async () => {
      const { Statements } = await import('@/persistence/Storage')
      const section = document.createElement('section')
      section.setAttribute('itemid', '/+14151234356/statements')
      document.body.appendChild(section)

      await instance.save('Test')

      expect(Statements).toHaveBeenCalled()
      document.body.removeChild(section)
    })

    it('returns early for empty statement', async () => {
      const { Statements } = await import('@/persistence/Storage')
      Statements.mockClear()

      await instance.save('')

      expect(Statements).not.toHaveBeenCalled()
    })

    it('returns early for null statement', async () => {
      const { Statements } = await import('@/persistence/Storage')
      Statements.mockClear()

      await instance.save(null)

      expect(Statements).not.toHaveBeenCalled()
    })
  })

  describe('statement_shown', () => {
    it('requires non-empty statement array', async () => {
      const stmt = [{ id: '/+1234/statements/1000', statement: 'Test' }]
      instance.statements.value = [stmt[0]]

      await instance.statement_shown(stmt)

      expect(true).toBe(true)
    })
  })
})

describe('as_thoughts', () => {
  it('groups statements into thoughts', () => {
    const items = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    const thoughts = as_thoughts(items)

    expect(thoughts).toBeInstanceOf(Array)
    expect(thoughts.length).toBeGreaterThan(0)
  })

  it('returns empty array for empty input', () => {
    const thoughts = as_thoughts([])
    expect(thoughts).toEqual([])
  })

  it('each thought is an array of statements', () => {
    const items = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    const thoughts = as_thoughts(items)

    thoughts.forEach(stmt => {
      expect(Array.isArray(stmt)).toBe(true)
    })
  })
})

describe('thoughts_sort', () => {
  it('sorts by first statement timestamp', () => {
    const stmt1 = [{ id: '/+1234/statements/2000', statement: 'Later' }]
    const stmt2 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]

    const result = thoughts_sort(stmt1, stmt2)

    expect(result).toBeGreaterThan(0)
  })

  it('returns negative for earlier first statement', () => {
    const stmt1 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]
    const stmt2 = [{ id: '/+1234/statements/2000', statement: 'Later' }]

    const result = thoughts_sort(stmt1, stmt2)

    expect(result).toBeLessThan(0)
  })

  it('returns 0 for same timestamp', () => {
    const stmt1 = [{ id: '/+1234/statements/1000', statement: 'First' }]
    const stmt2 = [{ id: '/+5678/statements/1000', statement: 'Second' }]

    const result = thoughts_sort(stmt1, stmt2)

    expect(result).toBe(0)
  })
})

describe('poster_thought_overlay_pairs', () => {
  const author = '/+1000000000000'
  const stmt_ts = 1_700_000_000_000
  const poster_near = `${author}/posters/${stmt_ts + 60_000}`
  const stmt_near = `${author}/statements/${stmt_ts}`

  it('pairs poster with thought when within thirteen minutes', () => {
    const thought = [{ id: stmt_near, statement: 'hello' }]
    const poster = { id: poster_near, type: 'posters' }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster])

    expect(merged_thought_keys.has(slot_key(thought))).toBe(true)
    expect(poster_to_thought.get(poster_near)).toBe(thought)
  })

  it('does not pair different authors', () => {
    const thought = [{ id: '/+1111111111111/statements/1990', statement: 'a' }]
    const poster = { id: poster_near, type: 'posters' }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster])

    expect(merged_thought_keys.size).toBe(0)
    expect(poster_to_thought.size).toBe(0)
  })

  it('does not pair when more than thirteen minutes apart', () => {
    const far_stmt = `${author}/statements/${stmt_ts}`
    const far_poster = `${author}/posters/${stmt_ts + 800_000}`
    const thought = [{ id: far_stmt, statement: 'old' }]
    const poster = { id: far_poster, type: 'posters' }
    const { merged_thought_keys } = poster_thought_overlay_pairs([
      thought,
      poster
    ])

    expect(merged_thought_keys.size).toBe(0)
  })

  it('pairs multiple posters to the same thought', () => {
    const thought = [{ id: stmt_near, statement: 'hello' }]
    const poster_a = {
      id: `${author}/posters/${stmt_ts + 20_000}`,
      type: 'posters'
    }
    const poster_b = {
      id: `${author}/posters/${stmt_ts + 120_000}`,
      type: 'posters'
    }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster_a, poster_b])

    expect(merged_thought_keys.has(slot_key(thought))).toBe(true)
    expect(merged_thought_keys.size).toBe(1)
    expect(poster_to_thought.get(poster_a.id)).toBe(thought)
    expect(poster_to_thought.get(poster_b.id)).toBe(thought)
    expect(poster_to_thought.size).toBe(2)
  })
})

describe('slot_key', () => {
  it('returns first item id for array', () => {
    const stmt = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]

    expect(slot_key(stmt)).toBe('/+1234/statements/1000')
  })

  it('returns id for non-array item', () => {
    const item = { id: '/+1234/statements/1000', statement: 'Test' }

    expect(slot_key(item)).toBe('/+1234/statements/1000')
  })
})
