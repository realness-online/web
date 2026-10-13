import { randomUUID } from 'node:crypto'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mirror_journal, MirrorBusy, MirrorLeaseLost } from '#services/mirror-journal.js'

const host = process.env.FIRESTORE_EMULATOR_HOST
const projectId = 'demo-realness-migration'
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

describe.skipIf(!host)('mirror journal on Firestore emulator', () => {
  let app, db
  const refs = []
  beforeAll(() => {
    if (!/^127\.0\.0\.1:\d+$/.test(host)) throw new Error('Loopback emulator required')
    app = initializeApp({ projectId }, `journal-test-${randomUUID()}`)
    db = getFirestore(app)
  })
  afterAll(async () => {
    for (const ref of refs) {
      // eslint-disable-next-line no-await-in-loop -- remove owned documents only
      await ref.delete()
    }
    await db.terminate()
    await deleteApp(app)
  })
  const make_pair = () => `people/+1/posters/${randomUUID()}.html`
  const tracked_db = {
    collection: name => ({ doc: key => {
      const ref = db.collection(name).doc(key)
      refs.push(ref)
      return ref
    } }),
    runTransaction: run => db.runTransaction(run)
  }

  it('serializes independent journal instances and retains intent across failures', async () => {
    const name = make_pair()
    const first = mirror_journal({ db: tracked_db })
    const second = mirror_journal({ db: tracked_db })
    const entered = deferred()
    const finish = deferred()
    const active = first.with_pair(name, async session => {
      await session.write({ pending: { action: 'copy', source_generation: '99' } })
      entered.resolve()
      await finish.promise
    })
    await entered.promise
    try {
      await expect(second.with_pair(name, async () => {})).rejects.toBeInstanceOf(MirrorBusy)
    } finally {
      finish.resolve()
      await active
    }
    await second.with_pair(name, async session => {
      expect(await session.read()).toEqual({ pending: { action: 'copy', source_generation: '99' } })
    })
  }, 20_000)

  it('fences an expired holder after takeover on the real transaction API', async () => {
    const name = make_pair()
    let clock = 100
    const first = mirror_journal({ db: tracked_db, now: () => clock, lease_ms: 1000 })
    const second = mirror_journal({ db: tracked_db, now: () => clock, lease_ms: 1000 })
    await first.with_pair(name, async old => {
      await old.write({ pending: { action: 'delete' } })
      clock = 1101
      await second.with_pair(name, async current => {
        expect(await current.read()).toEqual({ pending: { action: 'delete' } })
        await expect(old.write({ pending: null })).rejects.toBeInstanceOf(MirrorLeaseLost)
        await current.write({ pending: { action: 'delete', recovered: true } })
      })
    })
    await second.with_pair(name, async session => {
      expect((await session.read()).pending.recovered).toBe(true)
    })
  }, 20_000)
})
