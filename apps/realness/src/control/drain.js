/**
 * Move a halo's actors to a bucket, and only then let the halo go.
 *
 *   realness development halo drain realness-2            # export and ship, halo stays
 *   realness development halo drain realness-2 --delete   # ... and delete it after
 *
 * Runs on the control plane, not the halo: the halo has no credentials at all
 * (`halo up` creates it with --no-service-account), so it cannot upload its own
 * bundles and cannot be trusted to decide it is safe to die. This does both
 * from the outside.
 *
 * The order is the point. Every actor is exported, streamed to
 * `gs://<bucket>/actors/<id>/bundle.tar.gz`, and checked against what the
 * bucket says it stored; the bundle is then dropped from the halo's volume. The
 * delete happens last and only if every actor came back confirmed. Anything
 * else leaves the halo up, so a re-run is the retry.
 *
 * The shell version was 235 lines, and about 60 of them existed to work around
 * two bash properties: a command substitution is a subshell, so state cannot
 * live in variables set inside one; and exit status is not evidence, because a
 * `set -eu` script that dies still exits 0. Both disappear here - values are
 * returned, and a throw is a throw - which is most of why this file is shorter.
 */
import { createHash as create_hash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  mkdir,
  open,
  readFile as read_file,
  readdir,
  rm,
  stat
} from 'node:fs/promises'
import { join } from 'node:path'
import { attempt, step, note } from './exec.js'
import { remoteApi as remote_api } from './api.js'
import { out_root } from '#root/lib/output.js'
import { HTTP } from '#root/lib/http.js'
import { confirm_text, require_homes } from './drain-confirm.js'
/* eslint-disable no-await-in-loop -- actors ship one at a time so each export is proven before the next */

class DrainError extends Error {}

/** The three files every bundle must contain. */
const PARTS = ['artifacts.tar.gz', 'trace.jsonl', 'manifest.json']

/**
 * Drain one halo: export every actor, then remove or stop the VM. hs-n5: a
 * bundle in the bucket is not a home, so a delete asks the fleet first.
 * @param {{ exists: (argv: string[]) => Promise<boolean>, sshArgs: (name: string, command: string) => string[], stream: (argv: string[]) => Promise<unknown>, try: (argv: string[]) => Promise<unknown>, value: (argv: string[], format: string) => Promise<string> }} cloud
 * @param {{ project?: string, zone: string, bucket: string, haloExports?: string }} config
 * @param {string} name
 * @param {object} [options]
 * @param {boolean} [options.delete] remove the instance after draining
 * @param {string} [options.runDir] where the bundles land; a stamp folder by default
 * @param {(leaving: { name: string, api: object }) => Promise<{ name: string, actors: { id: string, state: string }[] }[]>} [options.fleet] hs-n5: read the other halos before a delete
 */
export const drain = async (
  cloud,
  config,
  name,
  { delete: drop = false, runDir, fleet } = {}
) => {
  const api = remote_api(name, { zone: config.zone })
  const run = runDir ?? join(dist(), `drain-${stamp()}`)

  step(
    `${name} (${config.project}/${config.zone}), bucket gs://${config.bucket}`
  )

  if (!(await cloud.exists(['instances', 'describe', name])))
    throw new DrainError(
      `no such instance ${name} in ${config.project}/${config.zone}`
    )

  const health = await probeHealth(api)
  if (!health)
    throw new DrainError(
      'no halo answering - start it with server/halo/scripts/halo-restart.sh'
    )

  note('health: seed and actors answered')

  const actors = JSON.parse(await api.call('/v1/actors')).actors ?? []
  step('actors on the halo')
  if (actors.length === 0) note('none')
  for (const actor of actors) note(`${actor.id}: ${actor.state}`)

  await mkdir(run, { recursive: true })

  step('export and ship')
  const counts = { shipped: 0, skipped: 0, failed: 0 }
  for (const actor of actors) {
    if (actor.state === 'incomplete') {
      note(`SKIP ${actor.id}: no disk (state ${actor.state})`)
      counts.skipped += 1
      continue
    }
    try {
      const shipped = await shipOne({ cloud, config, name, api, run }, actor.id)
      note(`${actor.id}: ${shipped.bytes} bytes, ${shipped.proof}`)
      counts.shipped += 1
    } catch (error) {
      note(`FAIL ${actor.id}: ${error.message}`)
      counts.failed += 1
      break
    }
  }

  note(
    `${counts.shipped} shipped, ${counts.skipped} skipped, ${counts.failed} failed`
  )
  if (counts.failed > 0)
    throw new DrainError(
      'the halo is left up: fix and re-run, or the delete takes actors with it'
    )

  if (!drop) {
    note(`bundles: gs://${config.bucket}/actors/<id>/bundle.tar.gz`)
    note(`run log: ${run}`)
    return { ...counts, run, deleted: false }
  }

  if (fleet) {
    step('confirm every actor has a home')
    const homes = require_homes(name, { actors }, await fleet({ name, api }))
    note(confirm_text(name)(homes))
  }

  await deleteHaloAndDisks(cloud, config, name)
  return { ...counts, run, deleted: true }
}

/** Export one actor, prove it arrived, then drop it from the volume. */
const shipOne = async ({ cloud, config, name, api, run }, id) => {
  const status = await api.call(`/v1/actors/${id}/export`, {
    method: 'POST',
    timeout: 300
  })
  let manifest
  try {
    manifest = JSON.parse(status)
  } catch {
    throw new DrainError(
      `export did not answer a manifest: ${status.slice(0, HTTP.OK)}`
    )
  }
  const expected = manifest.artifacts?.sha256
  const bytes = manifest.artifacts?.bytes ?? 0
  if (!expected) throw new DrainError('the manifest has no artifacts.sha256')

  const archive = join(run, `${id}.tgz`)
  await streamToFile(cloud, config, name, archive, id)

  const extracted = join(run, id)
  await rm(extracted, { recursive: true, force: true })
  const untar = await attempt('tar', ['-xzf', archive, '-C', run])
  if (!untar.ok)
    throw new DrainError(`the bundle will not untar: ${lastLine(untar.err)}`)

  const present = new Set(await readdir(extracted))
  const missing = PARTS.filter(part => !present.has(part))
  if (missing.length > 0)
    throw new DrainError(`the bundle is missing: ${missing.join(', ')}`)

  const artifacts = join(extracted, 'artifacts.tar.gz')
  const actual = create_hash('sha256')
    .update(await read_file(artifacts))
    .digest('hex')
  if (actual !== expected)
    throw new DrainError(
      `what came down (${actual}) is not the bundle (${expected})`
    )

  const object = `gs://${config.bucket}/actors/${id}/bundle.tar.gz`
  const copied = await attempt('gcloud', [
    'storage',
    'cp',
    '--quiet',
    archive,
    object
  ])
  if (!copied.ok) throw new DrainError(`upload failed: ${lastLine(copied.err)}`)

  const proof = await storedProof(archive, object, id)
  const removed = await attempt(
    'gcloud',
    cloud.sshArgs(
      name,
      `sudo rm -rf ${config.haloExports ?? '/opt/fc/actors/mnt/exports'}/${id}`
    )
  )
  if (!removed.ok)
    throw new DrainError('could not drop the bundle from the volume')

  return { bytes, proof }
}

/**
 * What the bucket reports, compared against what was sent.
 *
 * A composite upload has no whole-object md5, so the size is what is left. Said
 * out loud rather than passed off as an integrity check.
 */
const storedProof = async (archive, object, id) => {
  const described = await attempt('gcloud', [
    'storage',
    'objects',
    'describe',
    object,
    '--format=value(md5Hash,size)'
  ])
  if (!described.ok) throw new DrainError(`the bucket has no object for ${id}`)

  const [md5, size] = described.out.trim().split(/\s+/)
  const local = await stat(archive)
  if (md5) {
    const digest = create_hash('md5')
      .update(await read_file(archive))
      .digest('base64')
    if (digest !== md5)
      throw new DrainError(
        `the bucket has md5 ${md5}, not what was sent (${digest})`
      )

    return `md5 ${md5}`
  }
  if (String(local.size) !== size)
    throw new DrainError(
      `the bucket has ${size} bytes, not the ${local.size} sent`
    )

  return 'size only (composite upload)'
}

/**
 * `sudo tar -C <exports> -czf - <id>`, with stdout going straight to a file.
 *
 * Binary, so this cannot go through execFile: that collects stdout as a UTF-8
 * string, which mangles a gzip stream. spawn writes the bytes to a file
 * descriptor instead, the way the shell's `>` did.
 */
const streamToFile = async (cloud, config, name, target, id) => {
  const exports = config.haloExports ?? '/opt/fc/actors/mnt/exports'
  const args = cloud.sshArgs(name, `sudo tar -C ${exports} -czf - ${id}`)
  const handle = await open(target, 'w')
  try {
    /** @type {Promise<void>} */
    const printed = new Promise((resolve, reject) => {
      const child = spawn('gcloud', args, {
        stdio: ['ignore', handle.fd, 'pipe']
      })
      let err = ''
      child.stderr?.on('data', chunk => {
        err += chunk
      })
      child.on('error', reject)
      child.on('close', code => {
        if (code === 0) return resolve()
        reject(new DrainError(`could not stream ${id} down: ${lastLine(err)}`))
      })
    })
    await printed
  } finally {
    await handle.close()
  }
}

/**
 * Delete the halo and the disks it actually has.
 *
 * Enumerated, not guessed. Assuming `<name>-actors` is wrong for
 * realness-1, whose volume is named `realness-sessions`: the guess deletes the
 * instance and leaves a 30 GB disk behind, unattached and still billed.
 */
const deleteHaloAndDisks = async (cloud, config, name) => {
  step('delete the halo and the disks it has')
  const disks = await attachedDisks(cloud, name)
  note(`attached: ${disks.join(' ')}`)

  await cloud.stream(['instances', 'delete', name, '--quiet'])
  for (const disk of disks)
    await cloud.try(['disks', 'delete', disk, '--quiet'])

  if (await cloud.exists(['instances', 'describe', name]))
    throw new DrainError('the instance is still there')

  const left = []
  for (const disk of disks)
    if (await cloud.exists(['disks', 'describe', disk])) left.push(disk)

  if (left.length > 0)
    throw new DrainError(`disks left behind: ${left.join(' ')}`)

  note(`${name} and its disks are gone; the bundles are the state`)
  const remaining = await cloud.value(
    ['disks', 'list', `--filter=zone:${config.zone}`, '--format=value(name)'],
    'value(name)'
  )
  note(
    `left in ${config.zone}: ${remaining.replaceAll('\n', ' ') || 'nothing'}`
  )
}

/**
 * The names of the disks attached to an instance.
 *
 * Read from JSON, not from `--format=value(disks[].source.basename())`. That
 * format looks right and returns the *instance* name - so a delete loop over it
 * removes nothing and a 30 GB actors disk keeps billing after its halo is
 * gone. `source` is a full URL to the disk itself; this takes its last path
 * segment. Verified against realness-1, whose two disks are the boot disk and
 * a volume whose name does not match any pattern.
 */
const attachedDisks = async (cloud, name) => {
  const instance = await cloud.json(['instances', 'describe', name])
  const [self] = Array.isArray(instance) ? instance : [instance]
  return (self?.disks ?? [])
    .map(disk =>
      String(disk.source ?? '')
        .split('/')
        .pop()
    )
    .filter(Boolean)
}

const probeHealth = async api => {
  try {
    const health = JSON.parse(await api.call('/v1/health', { timeout: 30 }))
    return health.ok ? health : null
  } catch {
    return null
  }
}

const lastLine = text => text.trim().split('\n').pop()?.trim() ?? ''

const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')

/** Everything generated lands where lib/output.js says, never in the source tree. */
const dist = () => out_root()
