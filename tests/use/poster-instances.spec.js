import { describe, it, expect } from 'vite-plus/test'
import { elect_canonical } from '@/use/poster-instances'

const DOCUMENT_POSITION_FOLLOWING = 4
const DOCUMENT_POSITION_PRECEDING = 2

/**
 * Stub element ordered by `index` so the election's document-order tie-break is testable
 * without a DOM.
 * @param {number} index
 */
const node = index => ({
  index,
  compareDocumentPosition(other) {
    if (other === this) return 0
    return other.index > this.index
      ? DOCUMENT_POSITION_FOLLOWING
      : DOCUMENT_POSITION_PRECEDING
  }
})

const record = (uid, kind, in_view, index) => ({
  uid,
  kind,
  in_view,
  el: node(index)
})

describe('poster-instances election', () => {
  it('elects nobody when no instance is visible', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', false, 1)
    ]
    expect(elect_canonical(records)).toBe(null)
  })

  it('elects the only visible instance', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', true, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('prefers a visible full poster over a visible avatar', () => {
    // avatar earlier in document order, poster later — poster still wins on kind
    const records = [record(1, 'avatar', true, 0), record(2, 'poster', true, 1)]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('breaks ties by document order among the same kind', () => {
    const records = [
      record(1, 'poster', true, 2),
      record(2, 'poster', true, 0),
      record(3, 'poster', true, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('elects a visible avatar when no full poster is visible', () => {
    const records = [
      record(1, 'poster', false, 0),
      record(2, 'avatar', true, 1),
      record(3, 'avatar', true, 2)
    ]
    expect(elect_canonical(records)?.uid).toBe(2)
  })

  it('re-elects when the visible set changes (canonical migrates)', () => {
    const records = [
      record(1, 'poster', true, 0),
      record(2, 'poster', false, 1)
    ]
    expect(elect_canonical(records)?.uid).toBe(1)
    // first scrolls away, second scrolls in
    records[0].in_view = false
    records[1].in_view = true
    expect(elect_canonical(records)?.uid).toBe(2)
  })
})
