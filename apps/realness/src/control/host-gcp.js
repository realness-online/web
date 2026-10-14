/**
 * An actor host: create it, put code on it, take it away.
 *
 *   webspace development host up brayness-2 [--smoke]
 *   webspace development host down brayness-2 [--delete] [--no-drain]
 *   webspace development host restart brayness-2
 *
 * The host has no credentials at all - it is created with --no-service-account
 * - so it cannot upload its own bundles and cannot be trusted to decide it is
 * safe to die. Everything here is the Mac acting on it from outside.
 *
 * Everything is named explicitly. `gcloud instances create` will silently
 * attach an existing disk that shares the instance's name instead of creating
 * one, which is how a 20 GB request once booted a 100 GB disk.
 */
import { join } from 'node:path'
import {
  mkdtemp,
  mkdir,
  readdir,
  writeFile as write_file,
  rm
} from 'node:fs/promises'
import { attempt, step, note, run } from './exec.js'
import { ROOT } from './paths.js'
import { out_path } from '#root/lib/output.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- readiness polling waits between tries */

const SSH_TRIES = 40
const READY_TRIES = 30
const RETRY_MS = 5 * MS_PER_SECOND
const LOG_TAIL = 2

const bootDisk = name => `${name}-boot`
const actorsDisk = name => `${name}-actors`

/** Config supplies the sizes; a call may override any of them. */
const sizes = (config, options) => ({
  imageFamily: options.imageFamily ?? config.imageFamily,
  machineType: options.machineType ?? config.machineType,
  bootSize: options.bootSize ?? config.bootSize,
  actorsSize: options.actorsSize ?? config.actorsSize
})

export const up = async (
  cloud,
  config,
  name,
  { smoke = false, ...options } = {}
) => {
  const { imageFamily, machineType, bootSize, actorsSize } = sizes(
    config,
    options
  )
  const boot = bootDisk(name)
  const actors = actorsDisk(name)

  step('names must be free')
  for (const resource of [
    ['disks', 'describe', boot],
    ['instances', 'describe', name],
    ['disks', 'describe', actors]
  ])
    if (await cloud.exists(resource))
      throw new Error(
        `${resource.join(' ')} already exists - pick another name`
      )

  note(`${name}, ${boot}, ${actors}: all free`)

  step(`boot disk ${boot} (${bootSize}, image family ${imageFamily})`)
  await cloud.stream([
    'disks',
    'create',
    boot,
    `--size=${bootSize}`,
    '--type=pd-standard',
    `--image-family=${imageFamily}`,
    '--labels=app=brayness,role=actor-host'
  ])

  step(`instance ${name} (${machineType}, nested virt, no service account)`)
  const created = await cloud.try([
    'instances',
    'create',
    name,
    `--machine-type=${machineType}`,
    '--enable-nested-virtualization',
    `--disk=name=${boot},boot=yes,auto-delete=yes`,
    '--no-service-account',
    '--no-scopes',
    '--tags=brayness-host',
    '--labels=app=brayness,role=actor-host'
  ])
  if (!created.ok) {
    note(lastLine(created.err))
    note(`removing ${boot}`)
    await cloud.try(['disks', 'delete', boot, '--quiet'])
    throw new Error(`instance create failed: ${lastLine(created.err)}`)
  }
  note('created')

  step('waiting for ssh')
  for (let i = 0; i < SSH_TRIES; i += 1) {
    const result = await cloud.try(['ssh', name, '--quiet', '--command=true'])
    if (result.ok) break
    if (i % 5 === 0) note(`${i * 5}s`)
    await pause(RETRY_MS)
    if (i === SSH_TRIES - 1) throw new Error(`${name} never answered ssh`)
  }
  const block = await cloud.value([
    'ssh',
    name,
    '--quiet',
    '--command=lsblk -no NAME,SIZE,TYPE /dev/sda'
  ])
  note(block.split('\n').slice(-LOG_TAIL).join('  '))

  step(`actors volume ${actors} (${actorsSize})`)
  await cloud.stream([
    'disks',
    'create',
    actors,
    `--size=${actorsSize}`,
    '--type=pd-standard',
    '--labels=app=brayness,role=actors'
  ])
  await cloud.stream([
    'instances',
    'attach-disk',
    name,
    `--disk=${actors}`,
    '--device-name=brayness-actors'
  ])

  step('bootstrap on the host')
  await push(cloud, name)
  await cloud.ssh(
    name,
    `sudo bash ${config.root}/server/host/scripts/host-bootstrap.sh`
  )
  await ensure_template(cloud, config, name)

  if (smoke) {
    step('smoke test')
    await cloud.ssh(
      name,
      `bash ${config.root}/server/host/scripts/host-smoke.sh`
    )
  }

  await provision_record_key(cloud, config, name)
  await serve(cloud, config, name)
  return summary(cloud, config, name)
}

/** Stop it, keeping the disks. A start serves again in seconds. */
export const down = async (cloud, config, name, { mode = 'stop' } = {}) => {
  if (mode === 'delete') {
    step(`deleting ${name} and ${actorsDisk(name)}`)
    await cloud.stream(['instances', 'delete', name, '--quiet'])
    const volume = await cloud.try([
      'disks',
      'delete',
      actorsDisk(name),
      '--quiet'
    ])
    if (!volume.ok) note(`no ${actorsDisk(name)} volume`)
  } else {
    step(`stopping ${name} (disks kept)`)
    await cloud.stream(['instances', 'stop', name, '--quiet'])
    for (let i = 0; i < READY_TRIES; i += 1) {
      if ((await cloud.value(['instances', 'describe', name])) === 'TERMINATED')
        break
      await pause(RETRY_MS)
    }
    note(`${name}: ${await cloud.value(['instances', 'describe', name])}`)
  }

  step(`left in ${config.zone}`)
  note(
    await cloud.call([
      'disks',
      'list',
      '--format=table(name,sizeGb,type.basename(),users.basename())'
    ])
  )
}

/**
 * Copy the working tree up.
 *
 * The image carries a copy of the code, but the code is the thing that changes,
 * so the host gets the local working copies rather than whatever was baked in.
 * `host` imports from every other directory listed here. The host runs as root and leaves a root-owned
 * __pycache__, which makes the next scp fail, so hand the tree back first.
 */
export const push = async (cloud, name) => {
  step('stage the harness')
  await run('bash', [
    join(ROOT, 'tools', 'control', 'scripts', 'harness-stage.sh')
  ])
  step('copy the code')
  const scratch = out_path('host-stages')
  await mkdir(scratch, { recursive: true })
  const stage = await mkdtemp(join(scratch, 'push-'))
  try {
    await run('bash', [
      join(ROOT, 'tools/control/scripts/stage-host.sh'),
      stage
    ])
    await cloud.ssh(
      name,
      'mkdir -p ~/brayness/dist && sudo chown -R $(whoami):$(whoami) ~/brayness'
    )
    for (const entry of await readdir(stage))
      await cloud.stream([
        'scp',
        '--recurse',
        join(stage, entry),
        `${name}:~/brayness/`
      ])

    await cloud.stream([
      'scp',
      out_path('brayness-harness.tar.gz'),
      `${name}:~/brayness/dist/`
    ])
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

/** Rebuild the actor template when its inputs changed; the seed follows. */
export const ensure_template = async (cloud, config, name) => {
  step('actor template')
  await cloud.ssh(
    name,
    `sudo bash ${config.root}/tools/control/scripts/template-ensure.sh`
  )
}

/** Start the host on the host, by path. */
export const serve = async (cloud, config, name) => {
  step('serve')
  await cloud.ssh(
    name,
    `bash ${config.root}/server/host/scripts/host-restart.sh`
  )
}

export const restart = async (cloud, config, name) => {
  await push(cloud, name)
  await ensure_template(cloud, config, name)
  await provision_record_key(cloud, config, name)
  await serve(cloud, config, name)
  return summary(cloud, config, name)
}

export const provision_record_key = async (
  cloud,
  config,
  name,
  {
    upload = (file, destination) =>
      run('gcloud', [
        'storage',
        'cp',
        file,
        destination,
        '--project=realness-development'
      ]),
    scratch = join(ROOT, '../../artifacts/brayness'),
    read_secret = () =>
      cloud.call([
        'ssh',
        name,
        '--quiet',
        `--command=sudo bash ${config.root}/server/host/scripts/record-key.sh`
      ])
  } = {}
) => {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name))
    throw new Error('invalid host name')
  step(`register ${name} with sync`)
  const secret = (await read_secret()).trim()
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new Error('host record secret is invalid')
  await mkdir(scratch, { recursive: true })
  const dir = await mkdtemp(join(scratch, 'record-key-'))
  try {
    const file = join(dir, 'key')
    await write_file(file, secret, { mode: 0o600 })
    await upload(
      file,
      `gs://realness-development.firebasestorage.app/host-keys/${name}`
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const summary = async (cloud, config, name) => ({
  name,
  ip: await cloud.ip(name),
  park: `webspace development host down ${name}`,
  drop: `webspace development host down ${name} --delete`
})

const pause = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const lastLine = text =>
  text
    .trim()
    .split('\n')
    .filter(line => !line.startsWith('WARNING'))
    .pop()
    ?.trim() ?? ''

export { attempt }
