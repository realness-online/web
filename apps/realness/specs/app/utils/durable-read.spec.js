import { describe, expect, it } from 'vite-plus/test'
import { findLatestKind, readTail, readTranscript } from '@/utils/durable-read'

/**
 * A storage holding one conversation's entries, paged two at a time so every
 * read crosses a page.
 * @param {object[] | null} entries null when the conversation is missing
 * @param {object | undefined} [marker] the newest head marker
 */
const storage_of = (entries, marker) => ({
  conversation: async () => entries !== null,
  findLatestHeadMarker: async () => marker,
  scanEntries: async (query, limit, cursor = 0) => {
    const ordered =
      query.order === 'descending' ? [...entries].reverse() : [...entries]
    const kept = ordered.filter(
      entry => query.minEntryId === undefined || entry.id >= query.minEntryId
    )
    const size = Math.min(limit, 2)
    const items = kept.slice(cursor, cursor + size)
    const next = cursor + size < kept.length ? cursor + size : undefined
    return { items, next }
  }
})

const entries = [
  { id: 1, kind: 'message', model: { text: 'one' } },
  { id: 2, kind: 'message', model: { text: 'two' } },
  { id: 3, kind: 'head', head: 3, model: { text: 'summary' } },
  { id: 4, kind: 'message', model: { text: 'four' } },
  { id: 5, kind: 'note' }
]

describe('@/utils/durable-read', () => {
  it('reads every message when no head marker exists, across pages', async () => {
    const read = await readTranscript(storage_of(entries), {})
    expect(read).toEqual([
      { text: 'one' },
      { text: 'two' },
      { text: 'summary' },
      { text: 'four' }
    ])
  })

  it('reads from the newest head marker on, skipping later markers', async () => {
    const marker = entries[2]
    const read = await readTranscript(storage_of(entries, marker), {})
    expect(read).toEqual([{ text: 'summary' }, { text: 'four' }])
  })

  it('a missing conversation reads as empty everywhere', async () => {
    const none = storage_of(null)
    expect(await readTranscript(none, {})).toEqual([])
    expect(await readTail(none, {})).toBe(0)
    expect(await findLatestKind(none, ['message'], {})).toBeUndefined()
  })

  it('the tail is the newest entry, or 0 for an empty log', async () => {
    expect(await readTail(storage_of(entries), {})).toBe(5)
    expect(await readTail(storage_of([]), {})).toBe(0)
  })

  it('finds the newest entry of a kind, or nothing', async () => {
    const found = await findLatestKind(storage_of(entries), ['message'], {})
    expect(found?.id).toBe(4)
    expect(await findLatestKind(storage_of(entries), ['tool'], {})).toBe(
      undefined
    )
  })
})
