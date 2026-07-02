import { describe, it, expect } from 'vite-plus/test'
import { read_subjects, write_subjects } from '@/utils/subjects'

const itemid = '/+16282281824/posters/1576588885385'

const make_poster = () => {
  const fragment = document
    .createRange()
    .createContextualFragment(
      `<svg itemscope itemtype="/posters" itemid="${itemid}" viewBox="0 0 10 10"></svg>`
    )
  return fragment.querySelector('[itemid]')
}

describe('@/utils/subjects', () => {
  it('round-trips subjects through the index markup', () => {
    const poster = make_poster()
    write_subjects(poster, itemid, [
      {
        id: '1700000900001',
        name: 'Flower',
        keys: new Set(['rocks:3', 'sand:7'])
      },
      { id: '1700000900002', name: 'Foreground', keys: new Set(['boulders:0']) }
    ])

    const parsed = read_subjects(poster.outerHTML, itemid)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe('1700000900001')
    expect(parsed[0].name).toBe('Flower')
    expect([...parsed[0].keys]).toEqual(['rocks:3', 'sand:7'])
    expect(parsed[1].name).toBe('Foreground')
    expect([...parsed[1].keys]).toEqual(['boulders:0'])
  })

  it('writes SVG-native metadata (no HTML breakout-list tags)', () => {
    const poster = make_poster()
    write_subjects(poster, itemid, [
      { id: '1', name: 'Face', keys: new Set(['rocks:0']) }
    ])
    const html = poster.outerHTML
    expect(html).toContain('<metadata>')
    expect(html).toContain('itemprop="subject"')
    expect(html).toContain('itemtype="/subject"')
    expect(html).not.toMatch(/<span|<data|<ol|<li/)
  })

  it('replaces previously written subjects instead of duplicating', () => {
    const poster = make_poster()
    write_subjects(poster, itemid, [
      { id: '1', name: 'Old', keys: new Set(['rocks:0']) }
    ])
    write_subjects(poster, itemid, [
      { id: '2', name: 'New', keys: new Set(['sand:1']) }
    ])
    const parsed = read_subjects(poster.outerHTML, itemid)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('New')
  })

  it('returns an empty list for a poster with no subjects', () => {
    const poster = make_poster()
    expect(read_subjects(poster.outerHTML, itemid)).toEqual([])
  })

  it('clears the metadata when given no subjects', () => {
    const poster = make_poster()
    write_subjects(poster, itemid, [
      { id: '1', name: 'X', keys: new Set(['rocks:0']) }
    ])
    write_subjects(poster, itemid, [])
    expect(read_subjects(poster.outerHTML, itemid)).toEqual([])
  })
})
