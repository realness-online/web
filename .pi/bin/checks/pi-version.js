#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { version_drift } from '../lib/pi-version.js'

const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
const drift = version_drift(root)
if (drift.length) {
  process.stderr.write(`${drift.join('\n')}\n`)
  process.exit(1)
}
process.stdout.write('One Pi version in every place\n')
