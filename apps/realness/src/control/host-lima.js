/**
 * A host made by Lima, on this Mac.
 *
 * The same four verbs as a GCP host - make it, put the code on it, serve, take
 * it away - against a Linux VM instead of an instance. Firecracker needs
 * /dev/kvm and macOS has none, so the local host is a Lima VM with nested
 * virtualization.
 *
 * The steps are the same scripts a GCP host runs. What differs is the transport
 * (`limactl shell` rather than `gcloud compute ssh`) and that Lima has no disks
 * to create: the VM's own filesystem holds the actors volume.
 */
import { join } from 'node:path'
import { attempt, step, note } from './exec.js'
import { ROOT } from './paths.js'
import { waitForHealth as wait_for_health } from './api.js'
import { provision_record_key } from './host-gcp.js'
import { ensure_admins } from './admins.js'
import { disk } from '#root/src/can/disk.js'
import { local_person } from '#root/src/harness/settings.js'
import { out_path } from '#root/src/settings/output.js'

/** Local checks sign in as this test number; it stays an admin in the dev sync. */
export const DEV_OPERATOR = { phone: '+14156667777', name: 'Dev operator' }

/**
 * The local sync folder is shared with the guest, so the Mac names the admins:
 * the checkout's person, from person.local.html, and the test operator.
 */
export const seed_local_admins = async ({
  storage = disk(out_path('site-sync')),
  harness = join(ROOT, '../..')
} = {}) => {
  const me = local_person(harness)
  const done = await ensure_admins(storage, [me, DEV_OPERATOR])
  if (!me)
    note(
      'local admin is the test operator only; add person.local.html to be an admin yourself'
    )
  return done
}

/** The local host writes its records to the cloud sync, like a cloud host. */
const register = async (lima, config) => {
  const name = (await lima.run('hostname')).trim()
  await provision_record_key(null, config, name, {
    read_secret: () =>
      lima.run(`bash ${config.workdir}/server/host/scripts/record-key.sh`, {
        user: 'root'
      })
  })
}

export const up = async (
  lima,
  config,
  name,
  { smoke = false, fresh = false } = {}
) => {
  if (name && name !== config.vm)
    throw new Error(
      `dev has one Lima host, "${config.vm}". To use "${name}", add a config block for it.`
    )

  step(`lima: ${config.vm}`)
  note(await lima.start(join(ROOT, 'server', 'lima', 'fc-local.yaml')))

  step('firecracker, kernel, rootfs')
  await lima.streamScript('tools/control/scripts/guest-setup.sh')

  step('boot check')
  await lima.streamScript('tools/control/scripts/boot-check.sh')

  if (fresh) await down(lima, config, name)
  await register(lima, config)
  step('start the stack')
  const started = await startStack(lima, config, { fresh })
  note(started.alreadyUp ? 'already up' : 'started')

  if (smoke) {
    step('smoke test')
    await lima.streamScript('server/host/scripts/host-smoke.sh', {
      user: 'root'
    })
  }

  const health = await wait_for_health(config.api, { tries: 90, delayMs: 2000 })
  return {
    host: config.vm,
    api: `${config.api}/v1/health`,
    seed: health.seed?.built ? 'built' : 'missing',
    actors: countOf(health.actors)
  }
}

/** Put the code on the host. In dev it is already there: the Mac's directory is
 *  mounted at /mnt/fc, so there is nothing to copy. */
export const push = (lima, config, name) => {
  step('code')
  note(`${join(ROOT)} is mounted at ${config.workdir}; nothing to copy`)
  return { copied: false }
}

/** Start the host, if it is not already answering. */
export const serve = (lima, config, name) => startStack(lima, config)

/** Stop the host and any microVM it left running. */
export const down = async (lima, config, name, { mode = 'stop' } = {}) => {
  step(`stopping the dev stack${mode === 'delete' ? ' and the Lima VM' : ''}`)
  await lima.run(
    'pkill -f "[n]ode server/host/main.js" || true; pkill -x firecracker || true',
    { user: 'root' }
  )

  if (mode === 'delete') {
    await attempt('limactl', ['stop', config.vm])
    note(`${config.vm} stopped (not deleted: it is the dev environment)`)
  }
  return { stopped: true, deleted: mode === 'delete' }
}

export const restart = async (lima, config, name) => {
  const health = await probeHealth(config.api)
  if (health?.actors?.running)
    throw new Error(
      `${health.actors.running} actor(s) running; stop them before restarting the local host`
    )
  await down(lima, config, name)
  await register(lima, config)
  return serve(lima, config, name)
}

/**
 * The stack: actors volume, TAP, API.
 *
 * `tools/control/scripts/dev-stack.sh` does all three and `exec`s into the host, so
 * it is started detached - the host outlives this command and limactl
 * must not wait for a process that never exits.
 */
const startStack = async (lima, config, { fresh = false } = {}) => {
  const health = await probeHealth(config.api)
  if (health && !fresh) return { alreadyUp: true, health }

  await seed_local_admins()
  const prefix = fresh ? 'env FRESH=1 ' : ''
  const command =
    `out="$(bash -c '. ${config.workdir}/lib/output.sh && echo "$OUT"')" && nohup ${prefix}bash ` +
    `${config.workdir}/tools/control/scripts/dev-stack.sh > "$out/dev-up.log" 2>&1 &`
  await lima.run(command, { user: 'root', timeout: 30_000 })
  return {
    alreadyUp: false,
    health: await wait_for_health(config.api, { tries: 90, delayMs: 2000 })
  }
}

const probeHealth = async api => {
  try {
    const { stdout } = await attempt('curl', [
      '-sf',
      '--max-time',
      '3',
      `${api}/v1/health`
    ])
    const health = JSON.parse(stdout)
    return health.seed?.built ? health : null
  } catch {
    return null
  }
}

const countOf = actors => {
  const counts = Object.entries(actors ?? {})
    .map(([state, n]) => `${n} ${state}`)
    .join(', ')
  return counts || 'none'
}
