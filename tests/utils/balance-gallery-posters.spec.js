import { describe, it, expect, vi } from 'vite-plus/test'
import {
  balance_orientation,
  balance_gallery_posters
} from '@/utils/balance-gallery-posters'

vi.mock('@/utils/itemid', () => ({
  load_from_cache: vi.fn(async id => ({
    item: {
      viewbox: id.includes('wide') ? '0 0 400 200' : '0 0 200 400'
    },
    html: null
  }))
}))

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
})
