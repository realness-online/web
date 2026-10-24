import { describe, it, expect } from 'vite-plus/test'
import {
  thoughts_for_author,
  thought_feed_slots,
  thought_for_poster,
  thought_text,
  as_thoughts,
  thoughts_sort,
  slot_key,
  poster_thought_overlay_pairs
} from '../src/index.js'

const author = '/+14151234356'
const stmt = (ts, text = 'x') => ({
  id: `${author}/statements/${ts}`,
  type: /** @type {'thoughts'} */ ('thoughts'),
  statement: text
})
const poster = ts => ({
  id: `${author}/posters/${ts}`,
  type: /** @type {'posters'} */ ('posters')
})

describe('thoughts_for_author', () => {
  it('returns empty for empty input', () => {
    expect(thoughts_for_author([])).toEqual([])
  })

  it('one thought when two rows are within thirteen minutes', () => {
    const t0 = 1_700_000_000_000
    const thoughts = thoughts_for_author([
      stmt(t0, 'a'),
      stmt(t0 + 60_000, 'b')
    ])
    expect(thoughts).toHaveLength(1)
    expect(thoughts[0].statements).toHaveLength(2)
    expect(thoughts[0].posters).toHaveLength(0)
  })

  it('splits when gap exceeds thirteen minutes', () => {
    const t0 = 1_700_000_000_000
    const thoughts = thoughts_for_author([
      stmt(t0, 'a'),
      stmt(t0 + 800_000, 'b')
    ])
    expect(thoughts).toHaveLength(2)
  })

  it('joins poster and statement in one thought when close in time', () => {
    const t0 = 1_700_000_000_000
    const thoughts = thoughts_for_author([stmt(t0), poster(t0 + 30_000)])
    expect(thoughts).toHaveLength(1)
    expect(thoughts[0].posters).toHaveLength(1)
    expect(thoughts[0].statements).toHaveLength(1)
  })

  it('groups by id path when type field is missing', () => {
    const t0 = 1_700_000_000_000
    const s = { id: `${author}/statements/${t0}`, statement: 'a' }
    const p = { id: `${author}/posters/${t0 + 60_000}` }
    const thoughts = thoughts_for_author([s, p])
    expect(thoughts).toHaveLength(1)
    expect(thoughts[0].posters).toHaveLength(1)
    expect(thoughts[0].statements).toHaveLength(1)
  })
})

describe('thought_feed_slots', () => {
  it('orders statement run then poster by timestamp', () => {
    const t0 = 1_700_000_000_000
    const s = stmt(t0)
    const p = poster(t0 + 120_000)
    const thought = {
      author_id: author,
      started_at: t0,
      posters: [p],
      statements: [s]
    }
    const slots = thought_feed_slots(thought)
    expect(Array.isArray(slots[0])).toBe(true)
    expect(slots[1]).toEqual(p)
  })
})

describe('thought_for_poster', () => {
  const t0 = 1_700_000_000_000

  it('returns the poster its whole thought, not only the nearest rows', () => {
    const items = [
      stmt(t0, 'before'),
      poster(t0 + 60_000),
      stmt(t0 + 120_000, 'after'),
      stmt(t0 + 180_000, 'later')
    ]
    const thought = thought_for_poster(
      items,
      `${author}/posters/${t0 + 60_000}`
    )
    expect(thought_text(thought)).toBe('before after later')
  })

  it('reads a poster beyond the window as no words', () => {
    const items = [poster(t0), stmt(t0 + 800_000, 'much later')]
    expect(
      thought_text(thought_for_poster(items, `${author}/posters/${t0}`))
    ).toBe('')
  })

  it('returns null for a poster that is not in the items', () => {
    const items = [stmt(t0, 'a')]
    expect(thought_for_poster(items, `${author}/posters/${t0}`)).toBeNull()
  })

  it('reads a thought of posters alone as no words', () => {
    const items = [poster(t0), poster(t0 + 60_000)]
    const thought = thought_for_poster(items, `${author}/posters/${t0}`)
    expect(thought_text(thought)).toBe('')
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
    expect(as_thoughts([])).toEqual([])
  })

  it('each thought is an array of statements', () => {
    const items = [
      { id: '/+1234/statements/1000', statement: 'First' },
      { id: '/+1234/statements/1001', statement: 'Second' }
    ]
    for (const thought of as_thoughts(items))
      expect(Array.isArray(thought)).toBe(true)
  })

  it('keeps statements more than thirteen minutes apart in separate thoughts', () => {
    const t0 = 1_700_000_000_000
    const thoughts = as_thoughts([
      { id: `${author}/statements/${t0}`, statement: 'First' },
      { id: `${author}/statements/${t0 + 800_000}`, statement: 'Later' }
    ])
    expect(thoughts).toHaveLength(2)
  })
})

describe('thoughts_sort', () => {
  it('sorts by first statement timestamp', () => {
    const stmt1 = [{ id: '/+1234/statements/2000', statement: 'Later' }]
    const stmt2 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]
    expect(thoughts_sort(stmt1, stmt2)).toBeGreaterThan(0)
  })

  it('returns negative for earlier first statement', () => {
    const stmt1 = [{ id: '/+1234/statements/1000', statement: 'Earlier' }]
    const stmt2 = [{ id: '/+1234/statements/2000', statement: 'Later' }]
    expect(thoughts_sort(stmt1, stmt2)).toBeLessThan(0)
  })

  it('returns 0 for same timestamp', () => {
    const stmt1 = [{ id: '/+1234/statements/1000', statement: 'First' }]
    const stmt2 = [{ id: '/+5678/statements/1000', statement: 'Second' }]
    expect(thoughts_sort(stmt1, stmt2)).toBe(0)
  })
})

describe('poster_thought_overlay_pairs', () => {
  const overlay_author = '/+1000000000000'
  const stmt_ts = 1_700_000_000_000
  const poster_near = `${overlay_author}/posters/${stmt_ts + 60_000}`
  const stmt_near = `${overlay_author}/statements/${stmt_ts}`

  it('pairs poster with thought when within thirteen minutes', () => {
    const thought = [{ id: stmt_near, statement: 'hello' }]
    const poster = { id: poster_near, type: 'posters' }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster])
    expect(merged_thought_keys.has(slot_key(thought))).toBe(true)
    expect(poster_to_thought.get(poster_near)).toEqual(thought)
  })

  it('pairs poster without type when id is a poster path', () => {
    const thought = [{ id: stmt_near, statement: 'hello' }]
    const poster = { id: poster_near }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster])
    expect(merged_thought_keys.has(slot_key(thought))).toBe(true)
    expect(poster_to_thought.get(poster_near)).toEqual(thought)
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
    const thought = [{ id: stmt_near, statement: 'old' }]
    const poster = {
      id: `${overlay_author}/posters/${stmt_ts + 800_000}`,
      type: 'posters'
    }
    const { merged_thought_keys } = poster_thought_overlay_pairs([
      thought,
      poster
    ])
    expect(merged_thought_keys.size).toBe(0)
  })

  it('pairs multiple posters to the same thought', () => {
    const thought = [{ id: stmt_near, statement: 'hello' }]
    const poster_a = {
      id: `${overlay_author}/posters/${stmt_ts + 20_000}`,
      type: 'posters'
    }
    const poster_b = {
      id: `${overlay_author}/posters/${stmt_ts + 120_000}`,
      type: 'posters'
    }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought, poster_a, poster_b])
    expect(merged_thought_keys.has(slot_key(thought))).toBe(true)
    expect(merged_thought_keys.size).toBe(1)
    expect(poster_to_thought.get(poster_a.id)).toEqual(thought)
    expect(poster_to_thought.get(poster_b.id)).toEqual(thought)
    expect(poster_to_thought.size).toBe(2)
  })

  it('merges every statement slot in the train onto the poster overlay', () => {
    const t_a = stmt_ts - 60_000
    const t_b = stmt_ts + 60_000
    const t_c = stmt_ts + 120_000
    const thought_before = [
      { id: `${overlay_author}/statements/${t_a}`, statement: 'before' }
    ]
    const poster = {
      id: `${overlay_author}/posters/${stmt_ts}`,
      type: 'posters'
    }
    const thought_after = [
      { id: `${overlay_author}/statements/${t_b}`, statement: 'mid' },
      { id: `${overlay_author}/statements/${t_c}`, statement: 'after' }
    ]
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([thought_before, poster, thought_after])
    expect(merged_thought_keys.has(slot_key(thought_before))).toBe(true)
    expect(merged_thought_keys.has(slot_key(thought_after))).toBe(true)
    const merged = poster_to_thought.get(poster.id)
    expect(merged).toHaveLength(3)
    expect(merged.map(s => s.statement).join(' ')).toBe('before mid after')
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
