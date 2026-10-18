import { describe, expect, it } from 'vite-plus/test'
import { describe_parent, read_parent_past } from '@/utils/session-parent'

const storage_of = entries => ({
  scanEntries: async (query, limit) => {
    const items = entries
      .filter(entry => entry.id >= query.minEntryId)
      .slice(0, limit)
    return { items: query.order === 'ascending' ? items : items.reverse() }
  }
})

describe('read_parent_past', () => {
  it('reads nothing for a root conversation', async () => {
    const entries = await read_parent_past(
      storage_of([{ id: 5 }]),
      { forked: false, parent: null, anchor: null },
      {}
    )
    expect(entries).toEqual([])
  })

  it('starts after the anchor', async () => {
    const entries = await read_parent_past(
      storage_of([{ id: 7 }, { id: 9 }, { id: 12 }]),
      { forked: true, parent: 1, anchor: 7 },
      {}
    )
    expect(entries.map(entry => entry.id)).toEqual([9, 12])
  })

  it('reads nothing when the parent is quiet', async () => {
    const entries = await read_parent_past(
      storage_of([{ id: 7 }]),
      { forked: true, parent: 1, anchor: 7 },
      {}
    )
    expect(entries).toEqual([])
  })
})

describe('describe_parent', () => {
  it('counts what arrived', () => {
    expect(
      describe_parent([{ id: 9 }, { id: 12 }], {
        forked: true,
        parent: 1,
        anchor: 7
      })
    ).toEqual({
      count: 2,
      from: 9,
      to: 12,
      line: 'parent 1 added 2 after 7'
    })
  })

  it('says so when the parent is quiet', () => {
    expect(
      describe_parent([], { forked: true, parent: 1, anchor: 7 }).line
    ).toBe('parent 1 has nothing after 7')
  })

  it('names nothing for a root line', () => {
    expect(
      describe_parent([], { forked: false, parent: null, anchor: null }).line
    ).toBe('the original line')
  })
})
