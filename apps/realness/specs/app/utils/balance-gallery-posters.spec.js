import { describe, it, expect, vi } from 'vite-plus/test'
import {
  balance_orientation,
  balance_gallery_posters,
  cap_gallery_counts,
  gallery_counts_for_page_balance
} from '@/utils/balance-gallery-posters'

vi.mock('@/utils/itemid', () => ({
  load_from_cache: vi.fn(async id => ({
    item: {
      viewbox: id.includes('wide') ? '0 0 400 200' : '0 0 200 400'
    },
    html: null
  }))
}))

describe('gallery_counts_for_page_balance', () => {
  it('matches counts when featured and pool are even', () => {
    expect(
      gallery_counts_for_page_balance(
        { landscape: 2, portrait: 2 },
        { landscape: 8, portrait: 5 }
      )
    ).toEqual({ landscape: 5, portrait: 5 })
  })

  it('favors portrait in gallery when featured is landscape-heavy', () => {
    expect(
      gallery_counts_for_page_balance(
        { landscape: 3, portrait: 1 },
        { landscape: 10, portrait: 3 }
      )
    ).toEqual({ landscape: 1, portrait: 3 })
  })

  it('favors landscape in gallery when featured is portrait-heavy', () => {
    expect(
      gallery_counts_for_page_balance(
        { landscape: 1, portrait: 3 },
        { landscape: 5, portrait: 3 }
      )
    ).toEqual({ landscape: 5, portrait: 3 })
  })
})

describe('cap_gallery_counts', () => {
  it('returns counts unchanged when already within max', () => {
    expect(cap_gallery_counts({ landscape: 2, portrait: 3 }, 6)).toEqual({
      landscape: 2,
      portrait: 3
    })
  })

  it('trims larger orientation first when over max', () => {
    expect(cap_gallery_counts({ landscape: 5, portrait: 5 }, 6)).toEqual({
      landscape: 3,
      portrait: 3
    })
  })
})

describe('balance_orientation', () => {
  it('alternates when counts are close', () => {
    const items = ['L1', 'L2', 'L3', 'P1', 'P2', 'P3']
    const ordered = balance_orientation(items, id => id.startsWith('L'))
    expect(ordered.filter(id => id.startsWith('L')).length).toBe(3)
    expect(ordered.filter(id => id.startsWith('P')).length).toBe(3)
    for (let i = 1; i < ordered.length; i++) {
      const prev_land = ordered[i - 1].startsWith('L')
      const curr_land = ordered[i].startsWith('L')
      if (prev_land && curr_land) {
        const tail = ordered.slice(i)
        expect(tail.every(id => id.startsWith('L'))).toBe(true)
        break
      }
    }
  })

  it('does not leave all landscape at the front when portrait is scarce', () => {
    const items = ['L1', 'L2', 'L3', 'L4', 'L5', 'P1']
    const ordered = balance_orientation(items, id => id.startsWith('L'))
    expect(ordered[0].startsWith('L')).toBe(true)
    expect(ordered[1].startsWith('P')).toBe(true)
  })
})

describe('balance_gallery_posters', () => {
  it('reorders posters using cached viewbox orientation', async () => {
    const posters = [
      { id: '/a/posters/wide-1', type: 'posters' },
      { id: '/a/posters/wide-2', type: 'posters' },
      { id: '/a/posters/tall-1', type: 'posters' }
    ]
    const ordered = await balance_gallery_posters(posters)
    expect(ordered.map(p => p.id)).not.toEqual(posters.map(p => p.id))
    expect(ordered[1].id).toBe('/a/posters/tall-1')
  })

  it('balances page totals against featured posters', async () => {
    const featured = [
      { id: '/a/posters/wide-1', type: 'posters' },
      { id: '/a/posters/wide-2', type: 'posters' },
      { id: '/a/posters/wide-3', type: 'posters' },
      { id: '/a/posters/tall-1', type: 'posters' }
    ]
    const posters = [
      { id: '/a/posters/wide-4', type: 'posters' },
      { id: '/a/posters/wide-5', type: 'posters' },
      { id: '/a/posters/wide-6', type: 'posters' },
      { id: '/a/posters/tall-2', type: 'posters' },
      { id: '/a/posters/tall-3', type: 'posters' },
      { id: '/a/posters/tall-4', type: 'posters' }
    ]
    const ordered = await balance_gallery_posters(posters, { featured })

    const landscape = ordered.filter(p => p.id.includes('wide')).length
    const portrait = ordered.filter(p => p.id.includes('tall')).length
    expect(landscape).toBe(1)
    expect(portrait).toBe(3)
    expect(landscape + 3).toBe(portrait + 1)
  })

  it('caps gallery size when max is set', async () => {
    const featured = [
      { id: '/a/posters/wide-1', type: 'posters' },
      { id: '/a/posters/wide-2', type: 'posters' },
      { id: '/a/posters/wide-3', type: 'posters' },
      { id: '/a/posters/tall-1', type: 'posters' }
    ]
    const posters = [
      { id: '/a/posters/wide-4', type: 'posters' },
      { id: '/a/posters/wide-5', type: 'posters' },
      { id: '/a/posters/wide-6', type: 'posters' },
      { id: '/a/posters/tall-2', type: 'posters' },
      { id: '/a/posters/tall-3', type: 'posters' },
      { id: '/a/posters/tall-4', type: 'posters' }
    ]
    const ordered = await balance_gallery_posters(posters, { featured, max: 2 })

    expect(ordered).toHaveLength(2)
  })
})
