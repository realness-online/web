import { describe, it, expect } from 'vitest'
import { mirror_plan } from '#services/mirror-plan.js'

const old = 'people/+1/posters/123.html.gz'
const current = 'people/+1/posters/123.html'
const object = (generation, hash = 'same', metadata = {}) => ({
  generation, metageneration: '1', md5Hash: hash, size: '100',
  contentEncoding: 'gzip', metadata
})
const synced = {
  [old]: { generation: '11', metageneration: '1' },
  [current]: { generation: '12', metageneration: '1' }
}
const original = { [old]: object('11'), [current]: object('12') }
const plan = options => mirror_plan({ name: old, heads: original, synced, ...options })

describe('mirror_plan', () => {
  it.each([old, current])('a single edit on %s copies with both guards', name => {
    const result = plan({ heads: { ...original, [name]: object('99', 'edited') } })
    expect(result).toMatchObject({
      action: 'copy', name, source_generation: '99', source_metageneration: '1',
      target_metageneration: '1'
    })
  })

  it('recognizes duplicate deliveries and mirror echoes by equivalent live heads', () => {
    const heads = { [old]: object('99', 'edited'), [current]: object('100', 'edited') }
    const result = plan({ heads })
    expect(result.action).toBe('settled')
    expect(plan({ heads, synced: result.synced })).toEqual(result)
  })

  it('does not mistake a client-retained mirror marker for an echo', () => {
    const heads = {
      ...original, [old]: object('99', 'edited', { mirror: 'retained-marker' })
    }
    expect(plan({ heads })).toMatchObject({ action: 'copy', name: old })
  })

  it('stops on simultaneous divergent edits instead of inventing a winner', () => {
    const heads = { [old]: object('99', 'a'), [current]: object('100', 'b') }
    expect(plan({ heads })).toEqual({ action: 'conflict', reason: 'divergent-revisions' })
  })

  it('is independent of which suffix triggered reconciliation', () => {
    const heads = { ...original, [old]: object('99', 'edited') }
    expect(plan({ heads, name: current })).toEqual(plan({ heads }))
  })

  it('copies an initial object only into an absent counterpart', () => {
    expect(plan({ heads: { [old]: object('99') }, synced: {} })).toMatchObject({
      action: 'copy', name: old, target_generation: '0'
    })
  })

  it('does not resurrect a missing member while its delete event is delayed', () => {
    expect(plan({ heads: { [current]: original[current] } })).toEqual({
      action: 'wait', reason: 'missing-delete-evidence'
    })
  })

  it('propagates an exact acknowledged deletion to an unchanged counterpart', () => {
    expect(plan({
      heads: { [current]: original[current] }, deletion: { name: old, generation: '11' }
    })).toEqual({
      action: 'delete', name: old, target_generation: '12', target_metageneration: '1'
    })
  })

  it('ignores stale delete evidence', () => {
    expect(plan({
      heads: { [current]: original[current] }, deletion: { name: old, generation: '10' }
    }).action).toBe('wait')
  })

  it('does not let a delayed delete remove a recreated source', () => {
    expect(plan({
      heads: { ...original, [old]: object('99', 'recreated') },
      deletion: { name: old, generation: '11' }
    })).toMatchObject({ action: 'copy', name: old, source_generation: '99' })
  })

  it('preserves a concurrent edit against a deletion', () => {
    expect(plan({
      heads: { [current]: object('99', 'edited') },
      deletion: { name: old, generation: '11' }
    })).toEqual({ action: 'conflict', reason: 'delete-versus-edit' })
  })

  it('treats metadata-only changes as edits', () => {
    const changed = { ...original[old], metageneration: '2', metadata: { sold: 'true' } }
    expect(plan({ heads: { ...original, [old]: changed } })).toMatchObject({
      action: 'copy', source_metageneration: '2'
    })
  })

  it('refuses to copy an unsold edit over a sold counterpart', () => {
    const heads = {
      [old]: object('99', 'edited'),
      [current]: object('12', 'same', { sold: 'true' })
    }
    expect(plan({ heads })).toEqual({ action: 'conflict', reason: 'sold-state-regression' })
  })

  it('never interprets missing checksums as matching content', () => {
    expect(plan({ heads: { ...original, [old]: { ...original[old], md5Hash: undefined } } }).action)
      .toBe('conflict')
  })

  it('waits until any pending operation is recovered', () => {
    expect(plan({ pending: true })).toEqual({ action: 'wait', reason: 'unresolved-operation' })
  })

  it('settles an empty pair and ignores unrelated paths', () => {
    expect(plan({ heads: {} })).toEqual({ action: 'settled', synced: {} })
    expect(plan({ name: 'other/a.html' })).toEqual({ action: 'ignore' })
  })
})
