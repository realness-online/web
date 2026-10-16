/**
 * hs-f3: put one drained bundle back on a host, so restore can find it.
 *
 * Drain removes the export folder from the host it came from, so the bundle in
 * the bucket is the only copy left. `restore` reads a local export folder, so
 * the bundle has to be on the target host first. The Mac holds the storage
 * credentials and the host does not, so the copy passes through here, the same
 * way drain ships one the other direction.
 */
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { attempt, note, step } from './exec.js'
import { out_path } from '#root/lib/output.js'

class BundleError extends Error {}

/** The three files restore reads. */
const PARTS = ['artifacts.tar.gz', 'manifest.json']

/**
 * @param {{ sshArgs: (name: string, command: string) => string[] }} cloud
 * @param {{ zone: string, bucket: string, hostExports?: string }} config
 * @param {string} name the target host
 * @param {string} id the actor, which is also the export folder name
 * @param {{ object?: string, scratch?: string, run?: (argv: string[]) => Promise<{ ok: boolean, out: string, err: string }> }} [options]
 */
export const place_bundle = async (
  cloud,
  config,
  name,
  id,
  {
    object,
    scratch = out_path('moves'),
    run = argv => attempt('gcloud', argv)
  } = {}
) => {
  const source = object ?? `gs://${config.bucket}/actors/${id}/bundle.tar.gz`
  const here = join(scratch, id)
  await mkdir(here, { recursive: true })
  const archive = join(here, 'bundle.tar.gz')

  step(`bring ${id} down from the bucket`)
  const pulled = await run(['storage', 'cp', '--quiet', source, archive])
  if (!pulled.ok)
    throw new BundleError(`no bundle for ${id}: ${last_line(pulled.err)}`)

  step(`unpack ${id} on ${name}`)
  const exports = config.hostExports ?? '/opt/fc/actors/mnt/exports'
  const unpacked = await run([
    ...cloud.sshArgs(
      name,
      `sudo rm -rf ${exports}/${id} && sudo mkdir -p ${exports}/${id} && sudo tar -xzf - -C ${exports}/${id}`
    ),
    '--quiet'
  ])
  if (!unpacked.ok)
    throw new BundleError(
      `could not unpack on ${name}: ${last_line(unpacked.err)}`
    )

  const sent = await run([
    'compute',
    'scp',
    archive,
    `${name}:/tmp/${id}-bundle.tar.gz`,
    `--zone=${config.zone}`,
    '--quiet'
  ])
  if (!sent.ok)
    throw new BundleError(
      `could not copy the bundle up: ${last_line(sent.err)}`
    )

  const moved = await run([
    ...cloud.sshArgs(
      name,
      `sudo tar -xzf /tmp/${id}-bundle.tar.gz -C ${exports}/${id} && rm -f /tmp/${id}-bundle.tar.gz && ls ${exports}/${id}`
    ),
    '--quiet'
  ])
  if (!moved.ok)
    throw new BundleError(
      `could not unpack on ${name}: ${last_line(moved.err)}`
    )

  const present = PARTS.filter(part => moved.out.includes(part))
  if (present.length !== PARTS.length)
    throw new BundleError(
      `${id} on ${name} is missing ${PARTS.filter(part => !present.includes(part)).join(', ')}`
    )

  await rm(here, { recursive: true, force: true })
  note(`${id}: in ${exports} on ${name}`)
  return { id, host: name, export_dir: `${exports}/${id}` }
}

const last_line = text => String(text).trim().split('\n').at(-1) ?? ''

export { BundleError }
