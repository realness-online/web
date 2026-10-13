import { describe, it, expect, vi } from 'vitest'
import { migration_apply } from '#services/migration-apply.js'

const row = (source, status = 'copy') => ({ source, status })

describe('migration_apply', () => {
  it('reconciles only copy rows, never conflicts, matches or unverified rows', async () => {
    const reconcile = vi.fn(async () => ({ action: 'settled' }))
    const result = await migration_apply({
      rows: [row('a'), row('b', 'conflict'), row('c', 'matched'), row('d', 'unverified'), row('e')],
      reconcile
    })
    expect(reconcile.mock.calls.map(([name]) => name).sort()).toEqual(['a', 'e'])
    expect(result).toEqual({ counts: { settled: 2 }, failures: [] })
  })

  it('keeps going past failures and reports each one', async () => {
    const reconcile = vi.fn(async name => {
      if (name === 'b') throw Object.assign(new Error('precondition'), { code: 412 })
      if (name === 'c') return { action: 'conflict', reason: 'divergent-revisions' }
      return { action: 'settled' }
    })
    const result = await migration_apply({ rows: ['a', 'b', 'c', 'd'].map(name => row(name)), reconcile })
    expect(result.counts).toEqual({ settled: 2, error: 1, 'conflict:divergent-revisions': 1 })
    expect(result.failures).toEqual(expect.arrayContaining([
      { name: 'b', error: 'precondition', code: 412 },
      { name: 'c', reason: 'divergent-revisions' }
    ]))
  })

  it('bounds concurrency', async () => {
    let active = 0
    let peak = 0
    const reconcile = async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => { setTimeout(resolve, 5) })
      active--
      return { action: 'settled' }
    }
    await migration_apply({
      rows: Array.from({ length: 20 }, (_, i) => row(`n${i}`)), reconcile, concurrency: 3
    })
    expect(peak).toBe(3)
  })
})
