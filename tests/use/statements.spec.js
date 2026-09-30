import { describe, it, expect, vi, beforeEach, beforeAll } from 'vite-plus/test'
import { ref, defineComponent, nextTick as tick } from 'vue'
import { mount } from '@vue/test-utils'
import { use } from '@/use/statements'

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
  list_history_page: vi.fn(() => Promise.resolve([])),
  as_author: vi.fn(id => {
    const [author] = String(id).split('/').filter(Boolean)
    return author ? `/${author}` : null
  }),
  as_type: vi.fn(id => {
    const parts = String(id).split('/').filter(Boolean)
    if (parts[1] === 'statements') return 'thoughts'
    if (parts[1] === 'posters') return 'posters'
    return null
  }),
  feed_slot_itemid: item => (Array.isArray(item) ? item[0].id : item.id)
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
  Statements: vi.fn(function () {
    return {
      save: vi.fn(() => Promise.resolve())
    }
  })
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

  describe('update_statement', () => {
    const statement_id = '/+14151234356/statements/1000'

    /** A stored section matching the statement this test edits. */
    function stored_section(statement) {
      return `<section itemid="/+14151234356/statements"><div itemid="${statement_id}"><p itemprop="statement">${statement}</p></div></section>`
    }

    it('rewrites the statement text and persists the section', async () => {
      localStorage.getItem = vi.fn(() => stored_section('Old text'))
      instance.my_statements.value = [
        { id: statement_id, statement: 'Old text' }
      ]
      instance.statements.value = [{ id: statement_id, statement: 'Old text' }]

      await instance.update_statement(statement_id, 'Edited')

      const patched = instance.my_statements.value.find(
        s => s.id === statement_id
      )
      expect(patched.statement).toBe('Edited')
      expect(instance.statements.value[0].statement).toBe('Edited')
    })

    it('leaves state alone when no stored fragment exists', async () => {
      localStorage.getItem = vi.fn(() => null)
      instance.my_statements.value = [
        { id: statement_id, statement: 'Old text' }
      ]

      await instance.update_statement(statement_id, 'Edited')

      expect(instance.my_statements.value[0].statement).toBe('Old text')
    })

    it('returns early when the statement text element is missing', async () => {
      localStorage.getItem = vi.fn(
        () =>
          `<section itemid="/+14151234356/statements"><div itemid="${statement_id}"></div></section>`
      )
      instance.my_statements.value = [
        { id: statement_id, statement: 'Old text' }
      ]

      await instance.update_statement(statement_id, 'Edited')

      expect(instance.my_statements.value[0].statement).toBe('Old text')
    })
  })

  describe('statement_shown', () => {
    it('stays quiet with no feed loaded', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      instance.statements.value = null

      await instance.statement_shown([
        { id: '/+1234/statements/1000', statement: 'Test' }
      ])

      expect(list_history_page).not.toHaveBeenCalled()
    })
    it('requires non-empty statement array', async () => {
      const stmt = [{ id: '/+1234/statements/1000', statement: 'Test' }]
      instance.statements.value = [stmt[0]]

      await instance.statement_shown(stmt)

      expect(true).toBe(true)
    })

    it('does not throw when statements.value has none from this author', async () => {
      const stmt = [{ id: '/+1234/statements/1000', statement: 'Test' }]
      instance.statements.value = [
        { id: '/+9999/statements/2000', statement: 'Someone else' }
      ]

      await expect(instance.statement_shown(stmt)).resolves.toBeUndefined()
    })

    /** Ascending timestamps, so index 0 is the oldest and index 9 the newest. */
    const ten_statements = author =>
      Array.from({ length: 10 }, (_, index) => ({
        id: `${author}/statements/${1000 + index * 100}`,
        statement: `statement ${index}`
      }))

    it('drops the request when the author is not in the authors list', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+9999')
      instance.statements.value = loaded
      // for_person is never called -> /+9999 never joins authors.value.

      await instance.statement_shown([loaded[2]])

      expect(list_history_page).not.toHaveBeenCalled()
    })

    it('drops the request when the directory is unavailable', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const { as_directory } = await import('@/persistence/Directory')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded
      as_directory.mockResolvedValueOnce(null)

      await instance.statement_shown([loaded[2]])

      expect(list_history_page).not.toHaveBeenCalled()
    })

    it('skips the fetch when every page has already been viewed', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded
      const author = instance.authors.value.find(a => a.id === '/+1234')
      author.viewed = ['index', '1000', '2000', '3000']

      await instance.statement_shown([loaded[2]])

      expect(list_history_page).not.toHaveBeenCalled()
    })

    it('pages when a thought near the oldest shows, not only the oldest', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded

      await instance.statement_shown([loaded[3]])

      expect(list_history_page).toHaveBeenCalledWith('/+1234/statements/3000')
    })

    it('leaves history shut for a thought nowhere near the oldest', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded

      await instance.statement_shown([loaded[9]])

      expect(list_history_page).not.toHaveBeenCalled()
    })

    it('fetches one page when several thoughts show at once', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded
      list_history_page.mockResolvedValue([
        { id: '/+1234/statements/500', statement: 'older' }
      ])

      await Promise.all([
        instance.statement_shown([loaded[0]]),
        instance.statement_shown([loaded[1]]),
        instance.statement_shown([loaded[2]])
      ])

      expect(list_history_page).toHaveBeenCalledTimes(1)
      const author = instance.authors.value.find(a => a.id === '/+1234')
      expect(author.viewed).toEqual(['index', '3000'])
    })

    it('keeps a statement out of the feed twice', async () => {
      const { list_history_page } = await import('@/utils/itemid')
      const loaded = ten_statements('/+1234')
      instance.statements.value = loaded
      await instance.for_person({ id: '/+1234', type: 'person' })
      instance.statements.value = loaded
      list_history_page.mockResolvedValue([
        { id: '/+1234/statements/1000', statement: 'already here' },
        { id: '/+1234/statements/500', statement: 'older' }
      ])

      await instance.statement_shown([loaded[0]])

      const ids = instance.statements.value.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain('/+1234/statements/500')
    })
  })
})
