import { describe, it, expect } from 'vitest'
import { get_item } from '@/utils/item'
import { address_html_for_person } from '../helpers/profile-fixtures.js'

const me_id = '/+14151234356'

/**
 * Mirrors the sign-in branch in `init_serverless` (network profile vs default person).
 * @param {{ id: string, type: string, name?: string } | null} maybe_me
 * @param {{ id: string, type: string, name?: string }} default_me
 */
const session_me_after_sign_in = (maybe_me, default_me) =>
  maybe_me ? maybe_me : default_me

describe('profile lifecycle (sign-in hydration)', () => {
  it('new user: no network profile keeps default person without name', () => {
    const default_me = { id: me_id, type: 'person' }
    const maybe_me = /** @type {const} */ (null)
    const me = session_me_after_sign_in(maybe_me, default_me)
    expect(me.name).toBeUndefined()
  })

  it('existing user: network profile replaces default and carries name', () => {
    const default_me = { id: me_id, type: 'person' }
    const maybe_me = {
      id: me_id,
      type: 'person',
      name: 'From_cloud',
      visited: '2024-06-01T12:00:00.000Z'
    }
    const me = session_me_after_sign_in(maybe_me, default_me)
    expect(me).toEqual(maybe_me)
  })

  it('new device session: same as existing user if cloud returns an item', () => {
    const default_me = { id: me_id, type: 'person' }
    const cloud = {
      id: me_id,
      type: 'person',
      name: 'Other_device_wrote_this',
      visited: '2024-07-01T08:00:00.000Z',
      avatar: `${me_id}/posters/999`
    }
    expect(session_me_after_sign_in(cloud, default_me).name).toBe(
      'Other_device_wrote_this'
    )
  })
})

describe('profile HTML matches app microdata (stay current with cloud blob)', () => {
  it('parses name, visited, avatar from profile address html', () => {
    const html = address_html_for_person({
      id: me_id,
      name: 'Parse_me',
      visited: '2025-01-15T10:00:00.000Z',
      avatar: `${me_id}/posters/1`
    })
    const item = get_item(html, me_id)
    expect(item).toMatchObject({
      id: me_id,
      type: 'person',
      name: 'Parse_me',
      visited: '2025-01-15T10:00:00.000Z',
      avatar: `${me_id}/posters/1`
    })
  })
})
