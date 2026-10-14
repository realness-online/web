import { describe, it, expect } from 'vite-plus/test'
import {
  poster_thought_overlay_pairs,
  slot_key
} from '../src/pairing.js'

const author = '/+1000000000000'
const at = 1_700_000_000_000
const statement = (when, text = 'words') => ({
  id: `${author}/statements/${when}`,
  statement: text
})
const poster = (when) => ({ id: `${author}/posters/${when}`, type: 'posters' })

describe('poster_thought_overlay_pairs chains and edges', () => {
  it('chains a slot that touches the poster only through another slot', () => {
    const near = [statement(at)]
    const middle = [statement(at + 700_000)]
    const far = [statement(at + 1_400_000)]
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([near, middle, far, poster(at + 60_000)])
    expect(merged_thought_keys.size).toBe(3)
    const merged = poster_to_thought.get(`${author}/posters/${at + 60_000}`)
    expect(merged.map((one) => one.statement)).toEqual([
      'words',
      'words',
      'words'
    ])
  })

  it('leaves a slot alone when nothing bridges it to the poster', () => {
    const near = [statement(at)]
    const island = [statement(at + 1_400_000)]
    const { merged_thought_keys } = poster_thought_overlay_pairs([
      near,
      island,
      poster(at + 60_000)
    ])
    expect(merged_thought_keys.has(slot_key(near))).toBe(true)
    expect(merged_thought_keys.has(slot_key(island))).toBe(false)
  })

  it('counts a repeated statement once in the merged thought', () => {
    const shared = statement(at)
    const first = [shared]
    const second = [shared, statement(at + 60_000, 'next')]
    const { poster_to_thought } = poster_thought_overlay_pairs([
      first,
      second,
      poster(at + 30_000)
    ])
    const merged = poster_to_thought.get(`${author}/posters/${at + 30_000}`)
    expect(merged.map((one) => one.statement)).toEqual(['words', 'next'])
  })

  it('ignores statements and posters with no readable timestamp', () => {
    const untimed = [{ id: `${author}/statements/not-a-time`, statement: 'x' }]
    const no_time_poster = { id: `${author}/posters/not-a-time`, type: 'posters' }
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([untimed, no_time_poster, poster(at)])
    expect(merged_thought_keys.size).toBe(0)
    expect(poster_to_thought.size).toBe(0)
  })

  it('skips an entry with no id when looking for posters', () => {
    const { poster_to_thought } = poster_thought_overlay_pairs([
      null,
      { type: 'posters' },
      'not an item',
      [statement(at)],
      poster(at + 1_000)
    ])
    expect(poster_to_thought.size).toBe(1)
  })

  it('reads a poster from its id path when its type is something else', () => {
    const near = [statement(at)]
    const odd = { id: `${author}/posters/${at + 1_000}`, type: 'statements' }
    const { poster_to_thought } = poster_thought_overlay_pairs([near, odd])
    expect(poster_to_thought.has(odd.id)).toBe(true)
  })

  it('gives a poster every slot chained into one thought, not only the nearest', () => {
    const closer = [statement(at)]
    const further = [statement(at + 600_000)]
    const { poster_to_thought, merged_thought_keys } =
      poster_thought_overlay_pairs([closer, further, poster(at + 60_000)])
    const merged = poster_to_thought.get(`${author}/posters/${at + 60_000}`)
    expect(merged.map(one => one.statement)).toEqual(['words', 'words'])
    expect(merged_thought_keys.size).toBe(2)
  })

  it('returns nothing for a day with no posters', () => {
    const { merged_thought_keys, poster_to_thought } =
      poster_thought_overlay_pairs([[statement(at)], statement(at + 1_000)])
    expect(merged_thought_keys.size).toBe(0)
    expect(poster_to_thought.size).toBe(0)
  })
})

describe('slot_key with an empty slot', () => {
  it('names an empty statement slot with an empty key', () => {
    expect(slot_key([])).toBe('')
  })

  it('names a slot by its first statement', () => {
    expect(slot_key([{ id: 'a' }, { id: 'b' }])).toBe('a')
  })
})