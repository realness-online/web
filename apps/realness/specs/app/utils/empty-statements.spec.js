import { describe, it, expect } from 'vite-plus/test'
import { get_item } from '@/utils/item'
import { type_as_list } from '@/utils/itemid'

describe('an empty statements file', () => {
  const itemid = '/+14155550101/statements'
  const html = `<section itemscope itemid="${itemid}" data-days role="feed"></section>`

  it('reads back as a person with nothing to say', () => {
    const item = get_item(html, itemid)
    expect(item).toBeTruthy()
    expect(type_as_list(item)).toEqual([])
  })
})
