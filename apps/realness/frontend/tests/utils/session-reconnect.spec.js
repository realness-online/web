import { describe, expect, it } from 'vite-plus/test'
import {
  decide,
  mine_only,
  reconnect,
  seqs_of
} from '@/utils/session-reconnect'

describe('decide', () => {
  it('continues when both tails match', () => {
    expect(decide(8, 8)).toEqual({ verdict: 'continue', next: 9 })
  })

  it('follows a longer shared tail', () => {
    expect(decide(8, 12)).toEqual({ verdict: 'follow', next: 13 })
  })

  it('branches on a longer local tail', () => {
    expect(decide(12, 8)).toEqual({ verdict: 'branch', next: 13 })
  })

  it('continues on an empty session', () => {
    expect(decide(1, 1)).toEqual({ verdict: 'continue', next: 2 })
  })
})

describe('mine_only', () => {
  it('keeps sequences the shared log lacks', () => {
    expect(mine_only([2, 5, 9, 12], [2, 5, 8])).toEqual([9, 12])
  })

  it('treats everything as ours with no shared entries', () => {
    expect(mine_only([4, 7], [])).toEqual([4, 7])
  })
})

describe('reconnect', () => {
  it('reports no branch entries after a clean run', () => {
    const log = { tail: 8, seqs: [2, 5, 8], stores: { entries: [] } }
    expect(reconnect(log, log)).toEqual({
      verdict: 'continue',
      next: 9,
      our_tail: 8,
      their_tail: 8,
      branch_entries: []
    })
  })

  it('reports the strays written offline', () => {
    const ours = { tail: 12, seqs: [2, 5, 8, 9, 12], stores: { entries: [] } }
    const theirs = { tail: 8, seqs: [2, 5, 8], stores: { entries: [] } }
    const result = reconnect(ours, theirs)
    expect(result.verdict).toBe('branch')
    expect(result.branch_entries).toEqual([9, 12])
  })
})

describe('seqs_of', () => {
  it('reads a log sequence ascending', () => {
    const log = {
      stores: {
        entries: [{ value: { commitSeq: 8 } }, { value: { commitSeq: 2 } }]
      }
    }
    expect(seqs_of(log)).toEqual([2, 8])
  })
})
