import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  IAP_RANGE,
  lockdown,
  lockdown_plan
} from '../../src/control/lockdown.js'
import { gcloud } from '../../src/control/cloud.js'

const config = { project: 'realness-online', cloud: { region: 'us-west2' } }

test('the plan opens the narrow paths before it closes the wide ones', () => {
  const plan = lockdown_plan(config).map(argv => argv.join(' '))
  assert.match(
    plan[0],
    /create realness-host-iap-ssh .*--allow=tcp:22 --source-ranges=35\.235\.240\.0\/20 --target-tags=realness-host/
  )
  assert.match(
    plan[1],
    /create realness-host-api .*--allow=tcp:8080,tcp:8081 --source-ranges=10\.168\.0\.0\/20/
  )
  assert.match(
    plan[2],
    /delete default-allow-ssh --project=realness-online --quiet/
  )
  assert.match(plan[3], /delete default-allow-rdp/)
  assert.match(plan[4], /delete default-allow-internal/)
  assert.ok(plan.every(line => line.includes('--project=realness-online')))
  assert.throws(() => lockdown_plan({}), /needs a project/)
})

test('without --apply nothing runs', async () => {
  const ran = []
  const printed = []
  const result = await lockdown(config, {
    run: argv => ran.push(argv),
    print: line => printed.push(line)
  })
  assert.equal(ran.length, 0)
  assert.equal(printed.length, 5)
  assert.ok(
    printed.every(line =>
      line.startsWith('would run: gcloud compute firewall-rules')
    )
  )
  assert.deepEqual(result, {
    project: 'realness-online',
    applied: false,
    steps: 5
  })
})

test('apply is safe to rerun; any other failure stops it', async () => {
  const ok = await lockdown(config, {
    apply: true,
    print: () => {},
    run: async argv =>
      argv[2] === 'create'
        ? { ok: false, err: 'already exists' }
        : { ok: false, err: 'was not found' }
  })
  assert.equal(ok.applied, true)
  const ran = []
  await assert.rejects(
    lockdown(config, {
      apply: true,
      print: () => {},
      run: async argv => {
        ran.push(argv)
        return { ok: false, err: 'warning\nPERMISSION_DENIED' }
      }
    }),
    /PERMISSION_DENIED/
  )
  assert.equal(ran.length, 1, 'the wide rules stay until the narrow ones exist')
})

test('a locked-down config sends ssh and scp through IAP', () => {
  const locked = gcloud({ project: 'p', zone: 'z', iap: true })
  assert.ok(locked.sshArgs('h', 'true').includes('--tunnel-through-iap'))
  assert.ok(locked.scpArgs('a', 'h:b').includes('--tunnel-through-iap'))
  const open = gcloud({ project: 'p', zone: 'z' })
  assert.ok(!open.sshArgs('h', 'true').includes('--tunnel-through-iap'))
  assert.equal(IAP_RANGE, '35.235.240.0/20')
})

test('the gate subnet follows the region, and an unknown region is refused', () => {
  const central = lockdown_plan({
    project: 'p',
    cloud: { region: 'us-central1' }
  })
  assert.match(central[1].join(' '), /--source-ranges=10\.128\.0\.0\/20/)
  assert.throws(
    () => lockdown_plan({ project: 'p', cloud: { region: 'mars-1' } }),
    /no gate subnet known for region mars-1/
  )
})
