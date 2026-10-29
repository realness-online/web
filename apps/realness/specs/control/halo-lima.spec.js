/**
 * The local dev halo, with the Lima VM supplied.
 *
 * `up` and `down` reach the guest only through the `lima` object they are
 * given, so a stand-in runs the whole setup sequence. `up` is stopped at the
 * point it would talk to the cloud: what is not covered is anything after
 * `register`, which needs a real record key and a running stack.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import { disk } from '#root/src/can/disk.js'
import {
  DEV_OPERATOR,
  STOP_STACK,
  down,
  probeHealth,
  seed_local_admins,
  up
} from '../../src/control/halo-lima.js'

const config = {
  vm: 'realness-dev',
  workdir: '/home/person/realness',
  api: 'http://127.0.0.1:8080'
}

const scratch = (t, name) => {
  mkdirSync(out_path(), { recursive: true })
  const where = mkdtempSync(out_path(`${name}-`))
  t.after(() => rmSync(where, { recursive: true, force: true }))
  return where
}

const fake_lima = (answers = {}) => {
  const asked = []
  return {
    asked,
    start: async config_path => {
      asked.push(['start', config_path])
      return 'started'
    },
    run: async (command, options) => {
      asked.push(['run', command, options])
      const answer = answers.run?.(command, options)
      if (answer instanceof Error) throw answer
      return answer ?? 'realness-dev\n'
    },
    streamScript: async (script, options) => {
      asked.push(['streamScript', script, options])
    },
    stop: async () => {
      asked.push(['stop'])
    }
  }
}

it('the local admins page gets the dev operator, and says who is missing', async t => {
  const harness = scratch(t, 'lima-harness')
  const storage = disk(join(scratch(t, 'lima-sync'), 'site-sync'))

  const first = await seed_local_admins({ storage, harness })
  assert.equal(first.changed, true)
  assert.equal(first.before.length, 0)
  assert.deepEqual(
    first.after.map(admin => admin.phone),
    [DEV_OPERATOR.phone]
  )

  const again = await seed_local_admins({ storage, harness })
  assert.equal(again.changed, false)
  assert.deepEqual(again.after, again.before)
})

it('a local person file adds the checkout owner to the admins', async t => {
  const harness = scratch(t, 'lima-person')
  mkdirSync(join(harness, '.pi'), { recursive: true })
  writeFileSync(
    join(harness, '.pi/person.local.html'),
    '<a itemprop="telephone" href="tel:+14155551234">Scott</a>\n'
  )
  const storage = disk(join(scratch(t, 'lima-sync2'), 'site-sync'))

  const seeded = await seed_local_admins({ storage, harness })
  assert.deepEqual(
    seeded.after.map(admin => admin.phone).sort(),
    ['+14155551234', DEV_OPERATOR.phone].sort()
  )
})

it('dev has one Lima halo, and up says so when the name is another', async t => {
  const lima = fake_lima()
  await assert.rejects(
    up(lima, config, 'some-other-host'),
    /dev has one Lima halo, "realness-dev"\. To use "some-other-host", add a config block for it\./
  )
  assert.deepEqual(lima.asked, [])
})

it('up starts the VM, sets the guest up, and checks it boots', async t => {
  const lima = fake_lima({
    run: command => (command === 'hostname' ? new Error('guest is gone') : null)
  })
  await assert.rejects(up(lima, config, 'realness-dev'), /guest is gone/)

  const scripts = lima.asked
    .filter(([kind]) => kind === 'streamScript')
    .map(([, script]) => script)
  assert.deepEqual(scripts, [
    'tools/control/scripts/guest-setup.sh',
    'tools/control/scripts/boot-check.sh'
  ])
  assert.match(lima.asked[0][1], /server[\\/]lima[\\/]fc-local\.yaml$/)
  assert.equal(lima.asked.at(-1)[1], 'hostname')
})

it('down stops the halo and any microVM it left behind', async t => {
  const lima = fake_lima()
  const stopped = await down(lima, config, 'realness-dev')
  assert.deepEqual(stopped, { stopped: true, deleted: false })
  assert.equal(lima.asked.length, 1)
  assert.equal(lima.asked[0][1], STOP_STACK)
  assert.match(STOP_STACK, /pkill -x firecracker/)
  assert.match(STOP_STACK, /runc delete --force/)
  assert.deepEqual(lima.asked[0][2], { user: 'root' })
  assert.ok(!lima.asked.some(([verb]) => verb === 'stop'))
})

it('down matches every node the stack leaves, and not itself', () => {
  const pattern = new RegExp(STOP_STACK.match(/pkill -f "([^"]+)"/)[1])
  for (const line of [
    'node server/halo/main.js serve --runtime box --port 8080',
    '/usr/local/bin/node server/halo/main.js serve --runtime box --port 18085',
    'node /mnt/fc/server/sync/bin/sync-service.js',
    'node /mnt/fc/server/halo/scripts/port-forward.js 18097 host.lima.internal 8788'
  ])
    assert.match(line, pattern, line)
  assert.doesNotMatch(`sh -c ${STOP_STACK}`, pattern)
})

it('probeHealth reads what attempt returns, so a running halo is seen', async () => {
  const health = { runtime: 'box', seed: { built: true } }
  const answer = reply => async () => reply
  assert.deepEqual(
    await probeHealth(
      'http://x',
      answer({ ok: true, out: JSON.stringify(health) })
    ),
    health
  )
  assert.equal(
    await probeHealth('http://x', answer({ ok: false, out: '' })),
    null
  )
  assert.equal(
    await probeHealth('http://x', answer({ ok: true, out: '{"seed":{}}' })),
    null
  )
})

it('down with --vm also stops the Lima VM', async t => {
  const lima = fake_lima()
  const stopped = await down(lima, config, 'realness-dev', { stop_vm: true })
  assert.deepEqual(stopped, { stopped: true, deleted: false })
  assert.ok(lima.asked.some(([verb]) => verb === 'stop'))
})
