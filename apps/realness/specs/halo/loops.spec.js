import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { after, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  Loops,
  PROBE_ARGV,
  STOP_ARGV,
  launch_argv,
  stop_reason
} from '../../src/halo/loops.js'

const root = mkdtempSync(
  fileURLToPath(
    new URL('../../../../artifacts/realness/loops-', import.meta.url)
  )
)
after(() => rmSync(root, { recursive: true, force: true }))

const fake = () => {
  const records = {
    'a-000000000001': { id: 'a-000000000001', owner: '+14155550123' }
  }
  let n = 1
  const execs = []
  const work = new Set()
  const idled = []
  return {
    volume: root,
    execs,
    work,
    idled,
    beginWork: id => work.add(id),
    endWork: id => work.delete(id),
    idle: async id => idled.push(id),
    exec: async (id, argv) => (execs.push([id, argv]), { exit_code: 0 }),
    get: id => records[id],
    create: async owner => {
      const id = `a-${String(++n).padStart(12, '0')}`
      return (records[id] = { id, owner })
    }
  }
}

it('a loop is a sibling for the same owner', async () => {
  const store = fake()
  const loops = new Loops(store, { file: join(root, 'one.json') })
  const loop = await loops.start('a-000000000001', 'make tests faster')
  assert.equal(loop.depth, 1)
  assert.equal(store.get(loop.id).owner, '+14155550123')
  const saved = new Loops(store, { file: join(root, 'one.json') }).loops[
    loop.id
  ]
  assert.equal(saved.parent, 'a-000000000001')
  assert.equal(saved.status, 'running')
  assert.deepEqual(store.execs, [[loop.id, launch_argv('make tests faster')]])
  assert.equal(store.execs[0][1].at(-1), 'make tests faster')
})

it('a failed launch is recorded and frees the slot', async () => {
  const store = fake()
  store.exec = async () => ({
    exit_code: 1,
    stderr_b64: Buffer.from('no systemd').toString('base64')
  })
  const loops = new Loops(store, {
    file: join(root, 'fail.json'),
    maxChildren: 1
  })
  await assert.rejects(loops.start('a-000000000001', 'goal'), /no systemd/)
  assert.equal(Object.values(loops.loops)[0].status, 'failed')
  store.exec = async () => ({ exit_code: 0 })
  assert.equal((await loops.start('a-000000000001', 'goal')).depth, 1)
})

it('loops cannot start loops at depth 1', async () => {
  const loops = new Loops(fake(), { file: join(root, 'depth.json') })
  const loop = await loops.start('a-000000000001', 'goal')
  await assert.rejects(loops.start(loop.id, 'deeper'), /nest 1 deep/)
})

it('depth 2 allows one more level', async () => {
  const loops = new Loops(fake(), { file: join(root, 'two.json'), maxDepth: 2 })
  const first = await loops.start('a-000000000001', 'goal')
  const second = await loops.start(first.id, 'goal')
  assert.equal(second.depth, 2)
  await assert.rejects(loops.start(second.id, 'goal'), /nest 2 deep/)
})

it('racing starts respect the fan-out cap', async () => {
  const loops = new Loops(fake(), {
    file: join(root, 'fan.json'),
    maxChildren: 3
  })
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => loops.start('a-000000000001', 'goal'))
  )
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3)
})

it('bad goals and unowned actors are refused before any actor starts', async () => {
  const store = fake()
  let created = 0
  const create = store.create
  store.create = (...a) => (created++, create(...a))
  const loops = new Loops(store, { file: join(root, 'bad.json') })
  await assert.rejects(loops.start('a-000000000001', ''), /goal/)
  await assert.rejects(loops.start('a-000000000001', 'x'.repeat(4001)), /goal/)
  await assert.rejects(loops.start('a-999999999999', 'goal'), /owned actor/)
  assert.equal(created, 0)
})

const loop = { started: '2026-09-28T00:00:00Z' }
const at = minutes => Date.parse(loop.started) + minutes * 60_000
const limits = { maxRuns: 20, deadlineMs: 60 * 60_000 }

it('stop reasons: exited, quota, runs, deadline', () => {
  const running = { state: 'running', runs: 3, quota: false }
  assert.equal(stop_reason(running, loop, { ...limits, now: at(10) }), null)
  assert.equal(
    stop_reason({ ...running, state: 'exited' }, loop, {
      ...limits,
      now: at(10)
    }),
    'exited'
  )
  assert.equal(
    stop_reason({ ...running, quota: true }, loop, { ...limits, now: at(10) }),
    'quota'
  )
  assert.equal(
    stop_reason({ ...running, runs: 20 }, loop, { ...limits, now: at(10) }),
    'runs'
  )
  assert.equal(
    stop_reason(running, loop, { ...limits, now: at(60) }),
    'deadline'
  )
})

it('watch stops a finished loop, idles it, and frees the slot', async () => {
  const store = fake()
  const loops = new Loops(store, {
    file: join(root, 'watch.json'),
    maxChildren: 1,
    maxRuns: 2
  })
  const { id } = await loops.start('a-000000000001', 'goal')
  assert.ok(store.work.has(id))
  let runs = 1
  store.exec = async (_id, argv) => {
    store.execs.push([_id, argv])
    return argv === PROBE_ARGV
      ? {
          exit_code: 0,
          stdout_b64: Buffer.from(
            JSON.stringify({ state: 'running', runs, quota: false })
          ).toString('base64')
        }
      : { exit_code: 0 }
  }
  assert.deepEqual(await loops.watch(), [])
  assert.equal(loops.loops[id].runs, 1)
  assert.equal(loops.report('a-000000000001', id).status, 'running')
  assert.throws(() => loops.report('a-000000000077', id), /no such loop/)
  runs = 2
  assert.deepEqual(await loops.watch(), [{ id, reason: 'runs' }])
  assert.deepEqual(store.execs.at(-1), [id, STOP_ARGV])
  assert.deepEqual(store.idled, [id])
  assert.equal(store.work.has(id), false)
  assert.equal(loops.loops[id].status, 'stopped')
  await loops.start('a-000000000001', 'next')
})

it('a loop that exited is not stopped again', async () => {
  const store = fake()
  const loops = new Loops(store, { file: join(root, 'exit.json') })
  const { id } = await loops.start('a-000000000001', 'goal')
  store.exec = async (_id, argv) => (
    store.execs.push([_id, argv]),
    {
      exit_code: 0,
      stdout_b64: Buffer.from(
        '{"state":"exited","runs":4,"quota":false}'
      ).toString('base64')
    }
  )
  assert.deepEqual(await loops.watch(), [{ id, reason: 'exited' }])
  assert.equal(
    store.execs.some(([, argv]) => argv === STOP_ARGV),
    false
  )
})

it('a failed probe keeps the loop and records why', async () => {
  const store = fake()
  const loops = new Loops(store, { file: join(root, 'probe.json') })
  const { id } = await loops.start('a-000000000001', 'goal')
  store.exec = async () => ({ exit_code: 2 })
  assert.deepEqual(await loops.watch(), [])
  assert.equal(loops.loops[id].status, 'running')
  assert.match(loops.loops[id].error, /probe exit 2/)
})

it('report carries the last tail and never execs', async () => {
  const store = fake()
  const loops = new Loops(store, { file: join(root, 'report.json') })
  const { id } = await loops.start('a-000000000001', 'goal')
  store.exec = async () => ({
    exit_code: 0,
    stdout_b64: Buffer.from(
      JSON.stringify({
        state: 'exited',
        runs: 2,
        quota: false,
        tail: ['{"run":2}']
      })
    ).toString('base64')
  })
  await loops.watch()
  store.exec = async () => assert.fail('report must not exec')
  const report = loops.report('a-000000000001', id)
  assert.deepEqual(
    [report.status, report.reason, report.runs, report.tail],
    ['stopped', 'exited', 2, ['{"run":2}']]
  )
  assert.equal(report.goal, undefined)
  assert.throws(
    () => loops.report('a-000000000001', 'a-000000000999'),
    /no such loop/
  )
})

it('of_owner lists by actor owner, without the log tail', async () => {
  const store = fake()
  const loops = new Loops(store, { file: join(root, 'owner.json') })
  const { id } = await loops.start('a-000000000001', 'goal')
  loops.loops[id].tail = ['x']
  assert.deepEqual(
    loops.of_owner('+14155550123').map(loop => [loop.id, loop.goal, loop.tail]),
    [[id, 'goal', undefined]]
  )
  assert.deepEqual(loops.of_owner('+14155559999'), [])
})

it('mirror: records go to Storage; an admin stop request is obeyed', async () => {
  const store = fake()
  const files = new Map()
  const mirror = {
    put: async (key, body) => files.set(key, body),
    get: async key => (files.has(key) ? { body: files.get(key) } : null)
  }
  const loops = new Loops(store, {
    file: join(root, 'mirror.json'),
    mirror,
    halo: 'realness-1'
  })
  const { id } = await loops.start(
    'a-000000000001',
    'goal with "quotes" & <tags>'
  )
  const record = files.get(`loops/${id}/record.html`)
  assert.match(record, /itemprop="halo" content="realness-1"/)
  assert.match(record, /itemprop="owner" content="\+14155550123"/)
  assert.match(record, /itemprop="status" content="running"/)
  assert.match(record, /goal with &quot;quotes&quot; &amp; &lt;tags>/)
  files.set(`loops/${id}/stop.html`, 'stop')
  assert.deepEqual(await loops.watch(), [{ id, reason: 'admin' }])
  assert.deepEqual(store.execs.at(-1), [id, STOP_ARGV])
  assert.match(
    files.get(`loops/${id}/record.html`),
    /itemprop="reason" content="admin"/
  )
})

it('no mirror: loops run alone; a broken mirror never stops a loop', async () => {
  const store = fake()
  const broken = {
    put: async () => {
      throw new Error('gcs down')
    },
    get: async () => {
      throw new Error('gcs down')
    }
  }
  const loops = new Loops(store, {
    file: join(root, 'broken.json'),
    mirror: broken
  })
  const { id } = await loops.start('a-000000000001', 'goal')
  assert.equal(loops.loops[id].status, 'running')
  assert.match(loops.loops[id].error, /mirror: gcs down/)
})
