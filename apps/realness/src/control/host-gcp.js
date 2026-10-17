/**
 * An actor host: create it, put code on it, take it away.
 *
 *   realness development host up realness-2 [--smoke]
 *   realness development host down realness-2 [--delete] [--no-drain]
 *   realness development host restart realness-2
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
import { spawn } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile as read_file,
  writeFile as write_file,
  rm
} from 'node:fs/promises'
import { step, note, run } from './exec.js'
import { ROOT } from './paths.js'
import { out_path } from '#root/lib/output.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'

/** Copy a local file to gs://bucket/key with the storage client; gcloud storage crashes on Python 3.14. */
const upload_file = async (file, destination) => {
  const [bucket, ...key] = destination.slice('gs://'.length).split('/')
  await create_gcs({ bucket, token: gcloud_token() }).put(
    key.join('/'),
    await read_file(file)
  )
}
/* eslint-disable no-await-in-loop -- readiness polling waits between tries */

const SSH_TRIES = 40
const READY_TRIES = 30
const RETRY_MS = 5 * MS_PER_SECOND
const LOG_TAIL = 2

/** A provider-side deadline: GCE deletes the instance and its disks, even if this Mac is gone. */
const expiry = expire =>
  expire
    ? [`--max-run-duration=${expire}`, '--instance-termination-action=DELETE']
    : []

const bootDisk = name => `${name}-boot`
const actorsDisk = name => `${name}-actors`

/** Config supplies the sizes; a call may override any of them. */
const sizes = (config, options) => ({
  imageFamily: options.imageFamily ?? config.imageFamily,
  machineType: options.machineType ?? config.machineType,
  bootSize: options.bootSize ?? config.bootSize,
  actorsSize: options.actorsSize ?? config.actorsSize
})

/**
 * Guest setup runs before bootstrap: a plain base image has no Firecracker or
 * rootfs, and the actors volume step reads the rootfs.
 * @param {any} cloud
 * @param {any} config
 * @param {string} name
 * @param {{ smoke?: boolean, expire?: string, imageProject?: string, imageFamily?: string, machineType?: string, bootSize?: string, actorsSize?: string }} [options]
 *   expire: a GCE duration such as 2h, after which the provider deletes the host
 */
export const up = async (
  cloud,
  config,
  name,
  { smoke = false, expire, ...options } = {}
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
    ...((options.imageProject ?? config.imageProject)
      ? [`--image-project=${options.imageProject ?? config.imageProject}`]
      : []),
    '--labels=app=realness,role=actor-host'
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
    '--tags=realness-host',
    '--labels=app=realness,role=actor-host',
    ...expiry(expire)
  ])
  if (!created.ok) {
    note(lastLine(created.err))
    note(`removing ${boot}`)
    await cloud.try(['disks', 'delete', boot, '--quiet'])
    throw new Error(`instance create failed: ${lastLine(created.err)}`)
  }
  note('created')

  await wait_for_ssh(cloud, name)
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
    '--labels=app=realness,role=actors'
  ])
  await cloud.stream([
    'instances',
    'attach-disk',
    name,
    `--disk=${actors}`,
    '--device-name=realness-actors'
  ])
  if (expire)
    await cloud.stream([
      'instances',
      'set-disk-auto-delete',
      name,
      `--disk=${actors}`,
      '--auto-delete'
    ])

  step('bootstrap on the host')
  await push(cloud, config, name)
  await cloud.ssh(
    name,
    `test -x /opt/fc/firecracker || (sudo apt-get -qq update && sudo apt-get -qq install -y squashfs-tools && bash ${config.root}/tools/control/scripts/guest-setup.sh)`
  )
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
  await install_secrets(cloud, config, name)
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
const push = async (cloud, config, name) => {
  step(`stage the harness (${config.name})`)
  await run('bash', [
    join(ROOT, 'tools', 'control', 'scripts', 'harness-stage.sh'),
    config.name
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
      'mkdir -p ~/realness/dist && sudo chown -R $(whoami):$(whoami) ~/realness'
    )
    for (const entry of await readdir(stage))
      await cloud.stream([
        'scp',
        '--recurse',
        join(stage, entry),
        `${name}:~/realness/`
      ])

    await cloud.stream([
      'scp',
      out_path('realness-harness.tar.gz'),
      `${name}:~/realness/dist/`
    ])
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

/** Rebuild the actor template when its inputs changed; the seed follows. */
const ensure_template = async (cloud, config, name) => {
  step('actor template')
  await cloud.ssh(
    name,
    `sudo bash ${config.root}/tools/control/scripts/template-ensure.sh`
  )
}

/** A pass secret shorter than this is a mistake, not a secret. */
const SECRET_MIN = 32

/** Secret Manager names and the root-only files host-restart.sh reads. */
export const HOST_SECRETS = {
  HOST_PASS_SECRET: 'host-pass-secret',
  MODEL_PASS_SECRET: 'model-pass-secret'
}

/** Send argv to gcloud with `input` on stdin, so a secret never sits on a command line. */
const pipe_to = (cloud, argv, input) =>
  /** @type {Promise<void>} */ (
    new Promise((done, fail) => {
      const child = spawn('gcloud', argv, {
        env: { ...process.env, ...cloud.env },
        stdio: ['pipe', 'ignore', 'pipe']
      })
      let err = ''
      child.stderr.on('data', chunk => (err += chunk))
      child.on('close', code =>
        code ? fail(new Error(err.trim().split('\n').at(-1))) : done()
      )
      child.stdin.end(input)
    })
  )

/** Copy the pass secrets from Secret Manager onto the host, root-only. */
export const install_secrets = async (
  cloud,
  config,
  name,
  {
    read = secret =>
      run('gcloud', [
        'secrets',
        'versions',
        'access',
        'latest',
        `--secret=${secret}`,
        `--project=${config.project}`
      ]),
    send = (argv, input) => pipe_to(cloud, argv, input)
  } = {}
) => {
  step('pass secrets')
  for (const [secret, file] of Object.entries(HOST_SECRETS)) {
    const value = (await read(secret)).trim()
    if (value.length < SECRET_MIN)
      throw new Error(`${secret} is missing or too short`)
    await send(
      cloud.sshArgs(
        name,
        `sudo install -D -m 0600 -o root -g root /dev/stdin /etc/realness/${file}`
      ),
      value
    )
    note(`${file}: installed`)
  }
}

/** Start the host on the host, by path. */
const serve = async (cloud, config, name) => {
  if (!['development', 'production'].includes(config.name))
    throw new Error('host config needs name: development or production')
  step(`serve (${config.name})`)
  await cloud.ssh(
    name,
    `echo ${config.name} | sudo install -D -m 0644 /dev/stdin /etc/realness/environment`
  )
  await cloud.ssh(
    name,
    `bash ${config.root}/server/host/scripts/host-restart.sh`
  )
}

const wait_for_ssh = async (cloud, name) => {
  step('waiting for ssh')
  for (let i = 0; i < SSH_TRIES; i += 1) {
    const result = await cloud.try(['ssh', name, '--quiet', '--command=true'])
    if (result.ok) return
    if (i % 5 === 0) note(`${i * 5}s`)
    await pause(RETRY_MS)
  }
  throw new Error(`${name} never answered ssh`)
}

const HOLD = '/run/realness-hold'

/** Wake a parked host and keep it from parking until the work finishes. */
export const held = async (cloud, name, work) => {
  if ((await cloud.value(['instances', 'describe', name])) !== 'RUNNING') {
    step(`starting ${name}`)
    await cloud.stream(['instances', 'start', name, '--quiet'])
  }
  await wait_for_ssh(cloud, name)
  await cloud.ssh(name, `sudo touch ${HOLD}`)
  try {
    return await work()
  } finally {
    await cloud.ssh(name, `sudo rm -f ${HOLD}`)
  }
}

export const restart = (cloud, config, name) =>
  held(cloud, name, async () => {
    await push(cloud, config, name)
    await ensure_template(cloud, config, name)
    await provision_record_key(cloud, config, name)
    await install_secrets(cloud, config, name)
    await serve(cloud, config, name)
    return summary(cloud, config, name)
  })

export const provision_record_key = async (
  cloud,
  config,
  name,
  {
    upload = upload_file,
    scratch = join(ROOT, '../../artifacts/realness'),
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
  if (!config.project || !config.storage)
    throw new Error('host config needs project and storage')
  step(`register ${name} with sync`)
  const secret = (await read_secret()).trim()
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new Error('host record secret is invalid')
  await mkdir(scratch, { recursive: true })
  const dir = await mkdtemp(join(scratch, 'record-key-'))
  try {
    const file = join(dir, 'key')
    await write_file(file, secret, { mode: 0o600 })
    await upload(file, `gs://${config.storage}/host-keys/${name}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * hs-f2: take a failed host's authority before its actors are recovered.
 * Sync refuses passes the host minted and its record writes; the host may
 * still be running somewhere, so nothing here needs to reach it.
 */
export const revoke = async (
  config,
  name,
  {
    gcloud = argv => run('gcloud', [...argv, `--project=${config.project}`]),
    scratch = join(ROOT, '../../artifacts/realness'),
    now = () => new Date().toISOString()
  } = {}
) => {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name))
    throw new Error('invalid host name')
  if (!config.project || !config.storage)
    throw new Error('host config needs project and storage')
  step(`fence ${name} in sync`)
  await mkdir(scratch, { recursive: true })
  const dir = await mkdtemp(join(scratch, 'fence-'))
  try {
    const file = join(dir, 'fence')
    await write_file(file, JSON.stringify({ host: name, revoked_at: now() }))
    await gcloud([
      'storage',
      'cp',
      file,
      `gs://${config.storage}/host-fences/${name}`
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  step(`drop ${name}'s record key`)
  await gcloud([
    'storage',
    'rm',
    '--continue-on-error',
    `gs://${config.storage}/host-keys/${name}`
  ])
  return { host: name, fenced: true }
}

const summary = async (cloud, config, name) => ({
  name,
  ip: await cloud.ip(name),
  park: `realness ${config.name} host down ${name}`,
  drop: `realness ${config.name} host down ${name} --delete`
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
