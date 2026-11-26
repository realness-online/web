#!/usr/bin/env node
import { join } from 'node:path'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { disk } from '#root/src/can/disk.js'
import { find_root } from '#root/src/harness/harness.js'
import { deployment_settings } from '#root/src/settings/environments.js'
import { icloud_sync } from '#root/src/settings/output.js'
import { production_copy } from '#root/src/sync/mirror.js'

const args = process.argv.slice(2)
const unknown = args.filter(arg => arg !== '--write')
if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`)

const page = join(find_root(), 'vault/Switches.html')
const { bucket } = deployment_settings('production')
const to = icloud_sync()
const write = args.includes('--write')
const result = await production_copy({
  page,
  to: disk(to),
  from: () => create_gcs({ bucket, token: gcloud_token() }),
  write
})
if (!result) {
  process.stdout.write(`production copy is off (${page})\n`)
  process.exit(0)
}
process.stdout.write(
  `${bucket} -> ${to}\n${result.files} files, ${result.copies.length} to copy, ${result.removes.length} to remove\n`
)
process.stdout.write(
  write
    ? `copied ${result.copied}, removed ${result.removed}\n`
    : 'dry run: nothing written; add --write to copy\n'
)
