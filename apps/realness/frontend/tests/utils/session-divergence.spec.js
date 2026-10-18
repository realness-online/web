import { describe, expect, it, vi } from 'vite-plus/test'
import {
  divergence_of,
  read_divergence,
  say_divergence
} from '@/utils/session-divergence'

describe('divergence_of', () => {
  it('reads a root conversation as the original line', () => {
    expect(divergence_of({ id: 1 })).toEqual({
      forked: false,
      parent: null,
      anchor: null
    })
  })

  it('reads a fork parent and anchor', () => {
    expect(divergence_of({ parent: { conversationId: 1, at: 42 } })).toEqual({
      forked: true,
      parent: 1,
      anchor: 42
    })
  })

  it('reads a missing record as the original line', () => {
    expect(divergence_of(undefined)).toEqual({
      forked: false,
      parent: null,
      anchor: null
    })
  })
})

describe('say_divergence', () => {
  it('names the parent and the anchor', () => {
    expect(say_divergence({ forked: true, parent: 1, anchor: 42 })).toBe(
      'branched from 1 at 42'
    )
  })

  it('names nothing for a root line', () => {
    expect(say_divergence({ forked: false, parent: null, anchor: null })).toBe(
      'the original line'
    )
  })
})

describe('read_divergence', () => {
  it('reads through the storage handle alone', async () => {
    const storage = {
      conversation: vi.fn(async id =>
        id === 2 ? { parent: { conversationId: 1, at: 9 } } : { id }
      )
    }
    expect(await read_divergence(storage, 2, {})).toEqual({
      forked: true,
      parent: 1,
      anchor: 9
    })
    expect(await read_divergence(storage, 1, {})).toEqual({
      forked: false,
      parent: null,
      anchor: null
    })
  })
})
