import { describe, it, expect, vi, beforeEach } from 'vitest'

const { copy, remove } = vi.hoisted(() => ({ copy: vi.fn(), remove: vi.fn() }))
vi.mock('#services/mirror-copy.js', () => ({ mirror_copy: copy }))
vi.mock('#services/mirror-delete.js', () => ({ mirror_delete: remove }))
import { mirror_reconcile } from '#services/mirror-reconcile.js'

const old = 'people/+1/posters/123.html.gz'
const current = 'people/+1/posters/123.html'
const object = (generation, hash = 'same') => ({
  generation, metageneration: '1', md5Hash: hash, size: '100'
})
const fixture = () => {
  let state = {
    synced: {
      [old]: { generation: '11', metageneration: '1' },
      [current]: { generation: '12', metageneration: '1' }
    }
  }
  const heads = { [old]: object('99', 'edited'), [current]: object('12') }
  const session = {
    read: vi.fn(async () => state),
    write: vi.fn(async next => {
      const walk = value => {
        if (value === undefined) throw new Error('Cannot use "undefined" as a Firestore value')
        if (value && typeof value === 'object') Object.values(value).forEach(walk)
      }
      walk(next)
      state = structuredClone(next)
    })
  }
  const journal = { with_pair: vi.fn(async (name, run) => run(session)) }
  const bucket = {
    file: vi.fn(name => ({ getMetadata: async () => {
      if (!heads[name]) throw Object.assign(new Error('missing'), { code: 404 })
      return [heads[name]]
    } }))
  }
  return {
    heads, session, journal, bucket,
    run: extra => mirror_reconcile({ bucket, journal, name: old, ...extra })
  }
}

beforeEach(() => {
  copy.mockReset()
  remove.mockReset()
})

describe('mirror_reconcile', () => {
  it('journals intent before copying, then confirms both live heads', async () => {
    const { heads, session, run } = fixture()
    copy.mockImplementation(async () => {
      expect(session.write.mock.calls[0][0].pending.action).toBe('copy')
      heads[current] = object('100', 'edited')
    })
    expect((await run()).action).toBe('settled')
    expect(session.write.mock.lastCall[0].pending).toBeUndefined()
    expect(copy).toHaveBeenCalledTimes(1)
    await run()
    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('recovers a successful copy whose confirmation was lost, without copying again', async () => {
    const { heads, session, run } = fixture()
    copy.mockImplementation(async () => {
      heads[current] = object('100', 'edited')
      throw new Error('connection lost after write')
    })
    await expect(run()).rejects.toThrow('connection lost')
    expect(session.write.mock.lastCall[0].pending.action).toBe('copy')
    expect((await run()).action).toBe('settled')
    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('builds on a copy whose confirmation was lost when the source changed again', async () => {
    const { heads, run } = fixture()
    copy.mockImplementationOnce(async () => {
      heads[current] = object('100', 'edited')
      throw new Error('connection lost after write')
    })
    await expect(run()).rejects.toThrow('connection lost')
    heads[old] = object('101', 'edited again')
    copy.mockImplementationOnce(async () => { heads[current] = object('102', 'edited again') })
    expect((await run()).action).toBe('settled')
    expect(copy.mock.calls[1][0]).toMatchObject({ source_generation: '101', target_generation: '100' })
  })

  it('re-plans a copy that never ran instead of waiting forever', async () => {
    const { heads, run } = fixture()
    copy.mockRejectedValueOnce(new Error('timeout'))
    await expect(run()).rejects.toThrow('timeout')
    copy.mockImplementation(async () => { heads[current] = object('100', 'edited') })
    expect((await run()).action).toBe('settled')
    expect(copy).toHaveBeenCalledTimes(2)
    expect(copy.mock.calls[1][0]).toMatchObject({ source_generation: '99', target_generation: '12' })
  })

  it('keeps up with rapid saves to the source during a copy', async () => {
    const { heads, run } = fixture()
    copy.mockImplementationOnce(async () => {
      heads[current] = object('100', 'edited')
      heads[old] = object('101', 'edited again')
    })
    expect(await run()).toEqual({ action: 'wait', reason: 'post-operation-divergence' })
    copy.mockImplementationOnce(async () => { heads[current] = object('102', 'edited again') })
    expect((await run()).action).toBe('settled')
    expect(copy.mock.calls[1][0]).toMatchObject({ source_generation: '101', target_generation: '100' })
  })

  it('treats a client edit to the target during a copy as a conflict, not a wedge', async () => {
    const { heads, run } = fixture()
    copy.mockImplementationOnce(async () => { heads[current] = object('101', 'another edit') })
    expect(await run()).toEqual({ action: 'wait', reason: 'post-operation-divergence' })
    expect(await run()).toEqual({ action: 'conflict', reason: 'divergent-revisions' })
  })

  it('records a conflict once and answers it without re-planning until a name changes', async () => {
    const { heads, session, run } = fixture()
    heads[current] = object('50', 'their edit')
    expect(await run()).toEqual({ action: 'conflict', reason: 'divergent-revisions' })
    expect(session.write.mock.lastCall[0].conflict.reason).toBe('divergent-revisions')
    expect(await run()).toMatchObject({ action: 'conflict', recorded: true })
    heads[current] = object('51', 'edited')
    expect((await run()).action).toBe('settled')
    expect(copy).not.toHaveBeenCalled()
  })

  it('answers a recorded delete-versus-edit conflict without retrying', async () => {
    const { heads, run } = fixture()
    heads[old] = null
    heads[current] = object('99', 'edited')
    expect(await run({ deletion: { name: old, generation: '11' } }))
      .toEqual({ action: 'conflict', reason: 'delete-versus-edit' })
    expect(await run()).toMatchObject({ action: 'conflict', recorded: true })
  })

  it('never deletes on the archive an overwrite leaves behind', async () => {
    const { run } = fixture()
    copy.mockImplementation(async () => {})
    const result = await run({ deletion: { name: old, generation: '11' } })
    expect(remove).not.toHaveBeenCalled()
    expect(result.action).not.toBe('delete')
  })

  it('propagates guarded deletes and confirms absence', async () => {
    const { heads, run } = fixture()
    heads[old] = null
    remove.mockImplementation(async () => { heads[current] = null })
    expect(await run({ deletion: { name: old, generation: '11' } })).toEqual({
      action: 'settled', synced: {}
    })
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('surfaces permission failures without treating them as missing objects', async () => {
    const { bucket, session, run } = fixture()
    bucket.file.mockImplementation(() => ({ getMetadata: async () => {
      throw Object.assign(new Error('forbidden'), { code: 403 })
    } }))
    await expect(run()).rejects.toThrow('forbidden')
    expect(session.write).not.toHaveBeenCalled()
    expect(copy).not.toHaveBeenCalled()
  })

  it('does not write Storage for unrelated paths', async () => {
    const { journal, run } = fixture()
    expect(await run({ name: 'other/a.html' })).toEqual({ action: 'ignore' })
    expect(journal.with_pair).not.toHaveBeenCalled()
  })
})
