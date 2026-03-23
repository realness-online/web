import { describe, it, expect } from 'vitest'
import { thoughts_for_author, thought_feed_slots } from '@/utils/thoughts'

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

describe('@/utils/thoughts', () => {
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
  })

  describe('thought_feed_slots', () => {
    it('orders statement run then poster by timestamp', () => {
      const t0 = 1_700_000_000_000
      const s = stmt(t0)
      const p = poster(t0 + 120_000)
      const th = {
        author_id: author,
        started_at: t0,
        posters: [p],
        statements: [s]
      }
      const slots = thought_feed_slots(th)
      expect(Array.isArray(slots[0])).toBe(true)
      expect(slots[1]).toEqual(p)
    })
  })
})
