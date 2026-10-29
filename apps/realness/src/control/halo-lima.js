/**
 * A halo made by Lima, on this Mac.
 *
 * The same four verbs as a GCP halo - make it, put the code on it, serve, take
 * it away - against a Linux VM instead of an instance. Firecracker needs
 * /dev/kvm and macOS has none, so the local halo is a Lima VM with nested
 * virtualization.
 *
 * The steps are the same scripts a GCP halo runs. What differs is the transport
 * (`limactl shell` rather than `gcloud compute ssh`) and that Lima has no disks
 * to create: the VM's own filesystem holds the actors volume.
 */
import { readFile as read_file } from 'node:fs/promises'
import { GUEST_SECRETS, secret_path } from '#root/src/settings/secrets.js'
import { join } from 'node:path'
import { attempt, step, note } from './exec.js'
import { ROOT } from './paths.js'
import { waitForHealth as wait_for_health } from './api.js'
import { provision_record_key } from './halo-gcp.js'
import { ensure_admins } from './admins.js'
import { write_halo_status } from '#root/src/gate/halo-status.js'
import { person } from '#root/src/harness/settings.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { local_person } from '#root/src/harness/settings.js'
import { out_path } from '#root/src/settings/output.js'
import { local_runtime, runtime_matches } from './local-runtime.js'

/**
 * Everything dev-stack.sh leaves in the VM: the halo, its sync and port
 * forwards (all node under server/), firecracker microVMs, and runc boxes.
 */
export const STOP_STACK =
  'pkill -f "[n]ode (/mnt/fc/)?server/(halo|host|sync)/" || true; ' +
  'pkill -x firecracker || true; ' +
  'runc list -q 2>/dev/null | xargs -r -n1 runc delete --force || true'

/** Local checks sign in as this test number; it stays an admin in the dev sync. */
export const DEV_OPERATOR = { phone: '+14156667777', name: 'Dev operator' }

/**
 * The local sync folder is shared with the guest, so the Mac names the admins:
 * the checkout's person, from person.local.html, and the test operator.
 */
export const seed_local_admins = async ({
  storage = store_of(disk(out_path('site-sync'))),
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

/** lc1: the guest's copies of the pass secrets, from this Mac's own. */
const install_secrets = async lima => {
  for (const name of ['halo-pass-secret', 'model-pass-secret']) {
    // eslint-disable-next-line no-await-in-loop -- two small files, in order
    const value = (await read_file(secret_path(name), 'utf8')).trim()
    // eslint-disable-next-line no-await-in-loop -- two small files, in order
    await lima.install(`${GUEST_SECRETS}/${name}`, value)
  }
}

/** The local halo writes its records to the cloud sync, like a cloud halo. */
const register = async (lima, config) => {
  const name = (await lima.run('hostname')).trim()
  await provision_record_key(null, config, name, {
    read_secret: () =>
      lima.run(`bash ${config.workdir}/server/halo/scripts/record-key.sh`, {
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
      `dev has one Lima halo, "${config.vm}". To use "${name}", add a config block for it.`
    )

  try {
    return await up_steps(lima, config, name, { smoke, fresh })
  } catch (error) {
    write_halo_status('failed', error.message.split('\n')[0])
    throw error
  }
}

/** Each step says what it is doing, here and in the status the gate repeats. */
const doing = (heading, words) => {
  step(heading)
  write_halo_status('starting', words)
}

const up_steps = async (lima, config, name, { smoke, fresh }) => {
  doing(`lima: ${config.vm}`, 'starting the Linux VM')
  note(await lima.start(join(ROOT, 'server', 'lima', 'fc-local.yaml')))

  doing('firecracker, kernel, rootfs', 'checking the VM tools and disk images')
  await lima.streamScript('tools/control/scripts/guest-setup.sh')

  doing('boot check', 'checking a test VM boots')
  await lima.streamScript('tools/control/scripts/boot-check.sh')

  if (fresh) await down(lima, config, name)
  await register(lima, config)
  doing('start the stack', 'starting the agent server')
  const started = await startStack(lima, config, { fresh })
  note(started.alreadyUp ? 'already up' : 'started')

  if (smoke) {
    step('smoke test')
    await lima.streamScript('server/halo/scripts/halo-smoke.sh', {
      user: 'root'
    })
  }

  write_halo_status('starting', 'waiting for the agent server to answer')
  const health = await wait_for_health(config.api, { tries: 90, delayMs: 2000 })
  write_halo_status('up', 'answering')
  return {
    halo: config.vm,
    api: `${config.api}/v1/health`,
    seed: health.seed?.built ? 'built' : 'missing',
    actors: countOf(health.actors)
  }
}

/** Start the halo, if it is not already answering. */
const serve = (lima, config, name) => startStack(lima, config)

/** Stop the halo and any microVM it left running. */
export const down = async (
  lima,
  config,
  name,
  { mode = 'stop', stop_vm = false } = {}
) => {
  const stops_vm = mode === 'delete' || stop_vm
  step(`stopping the dev stack${stops_vm ? ' and the Lima VM' : ''}`)
  write_halo_status('stopped', 'stopping')
  await lima.run(STOP_STACK, { user: 'root' })

  if (stops_vm) {
    await lima.stop()
    note(
      mode === 'delete'
        ? `${config.vm} stopped (not deleted: it is the dev environment)`
        : `${config.vm} stopped`
    )
  }
  return { stopped: true, deleted: mode === 'delete' }
}

export const restart = async (lima, config, name) => {
  const health = await probeHealth(config.api)
  if (health?.actors?.running)
    throw new Error(
      `${health.actors.running} actor(s) running; stop them before restarting the local halo`
    )
  await down(lima, config, name)
  await register(lima, config)
  return serve(lima, config, name)
}

/**
 * The stack: actors volume, TAP, API.
 *
 * `tools/control/scripts/dev-stack.sh` does all three and `exec`s into the halo, so
 * it is started detached - the halo outlives this command and limactl
 * must not wait for a process that never exits.
 */
const startStack = async (lima, config, { fresh = false } = {}) => {
  const health = await probeHealth(config.api)
  if (health && !fresh && runtime_matches(health))
    return { alreadyUp: true, health }
  const runtime = local_runtime()
  if (health && !fresh) {
    note(
      `halo runs ${health.runtime ?? 'an older build'}; restarting on ${runtime}`
    )
    await down(lima, config, config.vm)
  }

  await seed_local_admins()
  await install_secrets(lima)
  /** The Mac's owner: only their box works on this Mac's vault. */
  const owner = person(join(ROOT, '..', '..'))?.slice(1)
  const flags = [
    fresh && 'FRESH=1',
    owner && `HOST_OWNER=${owner}`,
    `RUNTIME=${runtime}`
  ].filter(Boolean)
  const prefix = flags.length ? `env ${flags.join(' ')} ` : ''
  const command =
    `out="$(bash -c '. ${config.workdir}/lib/output.sh && echo "$OUT"')" && nohup ${prefix}bash ` +
    `${config.workdir}/tools/control/scripts/dev-stack.sh > "$out/dev-up.log" 2>&1 &`
  await lima.run(command, { user: 'root', timeout: 30_000 })
  return {
    alreadyUp: false,
    health: await wait_for_health(config.api, { tries: 90, delayMs: 2000 })
  }
}

export const probeHealth = async (api, run = attempt) => {
  try {
    const { ok, out } = await run('curl', [
      '-sf',
      '--max-time',
      '3',
      `${api}/v1/health`
    ])
    if (!ok) return null
    const health = JSON.parse(out)
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
