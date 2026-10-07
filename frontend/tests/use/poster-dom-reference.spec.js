import { describe, it, expect } from 'vite-plus/test'
import {
  POSTER_MEET_TOGGLE_ONLY,
  poster_dom_id,
  poster_dom_href
} from '@/use/poster-dom-reference'
import { as_query_id } from '@/utils/itemid'

describe('@/use/poster-dom-reference', () => {
  const itemid = /** @type {import('@/types').Id} */ (
    '/+14151234356/posters/1737178477987'
  )

  it('exposes the meet-toggle event name', () => {
    expect(POSTER_MEET_TOGGLE_ONLY).toBe('poster-toggle-meet-only')
  })

  it('poster_dom_id matches as_query_id', () => {
    expect(poster_dom_id(itemid)).toBe(as_query_id(itemid))
  })

  it('poster_dom_href prefixes the query id with a hash', () => {
    expect(poster_dom_href(itemid)).toBe(`#${as_query_id(itemid)}`)
  })
})
