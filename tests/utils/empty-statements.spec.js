import { describe, it, expect } from 'vite-plus/test'
import { get_item } from '@/utils/item'
import { type_as_list } from '@/utils/itemid'

describe('an empty statements file', () => {
  // This is the file sync now writes for a person who has never written a
  // thought. Every reader has to treat it as "no thoughts", not as broken.
  const itemid = '/+14155550101/statements'
  const html = `<section itemscope itemid="${itemid}" data-days role="feed"></section>`

  it('reads back as a person with nothing to say', () => {
    const item = get_item(html, itemid)
    expect(item).toBeTruthy()
    expect(type_as_list(item)).toEqual([])
  })
})
