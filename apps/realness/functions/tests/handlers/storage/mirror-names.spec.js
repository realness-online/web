import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('#utils/firebase.js', () => ({ bucket: { name: 'test' } }))
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn(() => ({})) }))
vi.mock('firebase-admin/app', () => ({ getApp: vi.fn() }))
vi.mock('firebase-functions/v2/storage', () => ({
  onObjectFinalized: vi.fn((options, run) => ({ options, run })),
  onObjectDeleted: vi.fn((options, run) => ({ options, run })),
  onObjectArchived: vi.fn((options, run) => ({ options, run }))
}))
vi.mock('#utils/log.js', () => ({ log_error: vi.fn(), log_info: vi.fn() }))

import {
  mirror_names_handler, mirror_names_written, mirror_names_deleted, mirror_names_archived
} from '#handlers/storage/mirror-names.js'
import { MirrorBusy } from '#services/mirror-journal.js'
import { onObjectArchived, onObjectDeleted } from 'firebase-functions/v2/storage'
import { log_error } from '#utils/log.js'

const name = 'people/+1/posters/123.html.gz'
const run = (result, extra = {}) => {
  const reconcile = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  return {
    reconcile,
    call: () => mirror_names_handler({ name, generation: 42 }, {
      ...extra, deps: { store: {}, journal: {}, reconcile }
    })
  }
}

beforeEach(() => vi.mocked(log_error).mockReset())

describe('mirror triggers', () => {
  it('watch the app bucket with retries enabled', () => {
    for (const trigger of [mirror_names_written, mirror_names_deleted, mirror_names_archived])
      expect(trigger.options).toMatchObject({ bucket: 'test', retry: true })
  })

  it('treat an archived file as delete evidence, since the bucket keeps versions', () => {
    const [[, archived]] = vi.mocked(onObjectArchived).mock.calls
    const [[, deleted]] = vi.mocked(onObjectDeleted).mock.calls
    expect(archived.toString()).toBe(deleted.toString())
  })
})

describe('mirror_names_handler', () => {
  it('refuses to mirror relations until the live rules protect the new name', async () => {
    const reconcile = vi.fn(async () => ({ action: 'settled' }))
    const relations = { name: 'people/+1/relations.html.gz', generation: 1 }
    await expect(mirror_names_handler(relations, {
      deps: { store: {}, journal: {}, reconcile, relations_safe: async () => false }
    })).rejects.toThrow('do not protect relations.html')
    expect(reconcile).not.toHaveBeenCalled()
    await mirror_names_handler(relations, {
      deps: { store: {}, journal: {}, reconcile, relations_safe: async () => true }
    })
    expect(reconcile).toHaveBeenCalledTimes(1)
  })

  it('does not consult the rules for other files', async () => {
    const relations_safe = vi.fn(async () => false)
    const reconcile = vi.fn(async () => ({ action: 'settled' }))
    await mirror_names_handler({ name, generation: 1 }, {
      deps: { store: {}, journal: {}, reconcile, relations_safe }
    })
    expect(relations_safe).not.toHaveBeenCalled()
  })

  it('ignores unrelated objects without touching the journal', async () => {
    const { reconcile } = run({ action: 'settled' })
    const result = await mirror_names_handler({ name: 'other/a.jpg' }, { deps: { reconcile } })
    expect(result).toEqual({ action: 'ignore' })
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('passes delete evidence with a string generation', async () => {
    const { reconcile, call } = run({ action: 'settled' }, { deleted: true })
    await call()
    expect(reconcile.mock.calls[0][0].deletion).toEqual({ name, generation: '42' })
  })

  it('passes no delete evidence for writes', async () => {
    const { reconcile, call } = run({ action: 'copy' })
    await call()
    expect(reconcile.mock.calls[0][0].deletion).toBeUndefined()
  })

  it.each(['post-operation-divergence', 'missing-delete-evidence'])(
    'retries a resolvable wait: %s', async reason => {
      await expect(run({ action: 'wait', reason }).call()).rejects.toThrow(reason)
    })

  it('acknowledges and logs a conflict instead of retrying forever', async () => {
    const result = await run({ action: 'conflict', reason: 'divergent-revisions' }).call()
    expect(result.action).toBe('conflict')
    expect(log_error).toHaveBeenCalledWith('mirror names: conflict', {
      name, reason: 'divergent-revisions'
    })
  })

  it.each([new MirrorBusy('busy'), Object.assign(new Error('pre'), { code: 412 }), new Error('io')])(
    'retries failures: %s', async error => {
      await expect(run(error).call()).rejects.toBe(error)
    })
})
