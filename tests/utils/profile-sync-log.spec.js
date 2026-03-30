import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  profile_sync_log,
  set_profile_sync_log_sink
} from '@/utils/profile-sync-log'

describe('profile_sync_log', () => {
  afterEach(() => {
    set_profile_sync_log_sink(null)
  })

  it('does nothing when no sink is set', () => {
    expect(() =>
      profile_sync_log('test_event', { itemid: '/+1' })
    ).not.toThrow()
  })

  it('forwards events to the sink', () => {
    const received = /** @type {{ event: string, detail: object }[]} */ ([])
    set_profile_sync_log_sink((event, detail) => {
      received.push({ event, detail })
    })

    profile_sync_log('visit_stamp_save', { itemid: '/+14151234356' })
    profile_sync_log('me_save_persist', { name: 'A', visited: 't' })

    expect(received).toEqual([
      {
        event: 'visit_stamp_save',
        detail: { itemid: '/+14151234356' }
      },
      {
        event: 'me_save_persist',
        detail: { name: 'A', visited: 't' }
      }
    ])
  })
})
