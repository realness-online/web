#! /usr/bin/env node
import { remove_plain } from '#root/src/can/remove-plain.js'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { deployment_settings } from '#root/src/settings/environments.js'

const args = process.argv.slice(2)
const unknown = args.filter(arg => arg !== '--write')
if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`)

const write = args.includes('--write')
const { bucket } = deployment_settings('production')
const storage = create_gcs({ bucket, token: await gcloud_token() })
const result = await remove_plain(storage, { write })

for (const { source } of result.deletes) process.stdout.write(`${source}\n`)
process.stdout.write(
  `${result.pending} plain originals with a .gz twin, ${result.skipped} kept\n`
)
process.stdout.write(
  write
    ? `deleted ${result.deleted}\n`
    : 'dry run: nothing deleted; add --write to remove\n'
)
