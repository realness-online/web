import { describe, it, expect, vi } from 'vitest'
import { mirror_journal, MirrorBusy, MirrorLeaseLost } from '#services/mirror-journal.js'

/** Transaction fake serializes access, like Firestore's commit boundary. */
const fixture = () => {
  const records = new Map()
  let queue = Promise.resolve()
  let clock = 100
  let serial = 0
  const db = {
    collection: vi.fn(() => ({ doc: key => key })),
    runTransaction: run => {
      const result = queue.then(async () => {
        const writes = new Map()
        const transaction = {
          get: async ref => ({ data: () => structuredClone(records.get(ref)) }),
          set: (ref, value) => writes.set(ref, structuredClone(value))
        }
        const value = await run(transaction)
        for (const [key, record] of writes) records.set(key, record)
        return value
      })
      queue = result.catch(() => {})
      return result
    }
  }
  const journal = mirror_journal({
    db, now: () => clock, new_token: () => `token-${++serial}`, lease_ms: 1000
  })
  return { db, records, journal, advance: ms => { clock += ms } }
}
const name = 'people/+1/posters/123.html'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

describe('mirror_journal', () => {
  it('persists intent after the holder fails and releases only the lease', async () => {
    const { journal, records } = fixture()
    await expect(journal.with_pair(name, async session => {
      await session.write({ pending: { action: 'copy' } })
      throw new Error('crash')
    })).rejects.toThrow('crash')
    await journal.with_pair(name, async session => {
      expect(await session.read()).toEqual({ pending: { action: 'copy' } })
    })
    expect([...records.values()][0].lease).toBeNull()
  })

  it('refuses concurrent ownership of a pair', async () => {
    const { journal } = fixture()
    const entered = deferred()
    const finish = deferred()
    const first = journal.with_pair(name, async () => {
      entered.resolve()
      await finish.promise
    })
    await entered.promise
    await expect(journal.with_pair(name, async () => {})).rejects.toBeInstanceOf(MirrorBusy)
    finish.resolve()
    await first
  })

  it('allows unrelated pairs to proceed independently', async () => {
    const { journal } = fixture()
    await journal.with_pair(name, async () => {
      await expect(journal.with_pair('people/+2/index.html', async () => 'other')).resolves.toBe('other')
    })
  })

  it('fences an expired holder and retains intent for its successor', async () => {
    const { journal, advance } = fixture()
    await journal.with_pair(name, async first => {
      await first.write({ pending: { action: 'copy' } })
      advance(1001)
      await journal.with_pair(name, async second => {
        expect(await second.read()).toEqual({ pending: { action: 'copy' } })
        await expect(first.write({ pending: null })).rejects.toBeInstanceOf(MirrorLeaseLost)
        await second.write({ pending: { action: 'copy', recovered: true } })
      })
    })
    await journal.with_pair(name, async session => {
      expect(await session.read()).toEqual({ pending: { action: 'copy', recovered: true } })
    })
  })

  it('does not release a successor lease when an old holder exits', async () => {
    const { journal, records, advance } = fixture()
    const entered = deferred()
    const finish = deferred()
    let second
    await journal.with_pair(name, async () => {
      advance(1001)
      second = journal.with_pair(name, async () => {
        entered.resolve()
        await finish.promise
      })
      await entered.promise
    })
    expect([...records.values()][0].lease.token).toBe('token-2')
    finish.resolve()
    await second
  })

  it('rejects access at the lease boundary without a successor', async () => {
    const { journal, advance } = fixture()
    await journal.with_pair(name, async session => {
      advance(1000)
      await expect(session.read()).rejects.toBeInstanceOf(MirrorLeaseLost)
    })
  })

  it('renews an active lease on journal access', async () => {
    const { journal, advance } = fixture()
    await journal.with_pair(name, async session => {
      advance(999)
      await session.write({ pending: null })
      advance(999)
      expect(await session.read()).toEqual({ pending: null })
    })
  })
})
