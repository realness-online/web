#!/usr/bin/env node
import { copy_layout } from '#root/src/can/copy-layout.js'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { deployment_settings } from '#root/src/settings/environments.js'

const args = process.argv.slice(2)
const unknown = args.filter(arg => arg !== '--write')
if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`)

const write = args.includes('--write')
const { bucket } = deployment_settings('production')
const storage = create_gcs({ bucket, token: gcloud_token() })
const result = await copy_layout(storage, { write })

for (const { source, destination } of result.copies)
  process.stdout.write(`${source} -> ${destination}\n`)
process.stdout.write(
  `${result.files} originals, ${result.pending} pending, ${result.skipped} current\n`
)
process.stdout.write(
  write
    ? `copied ${result.copied}\n`
    : 'dry run: nothing written; add --write to copy\n'
)
