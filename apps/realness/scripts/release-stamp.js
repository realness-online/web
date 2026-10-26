/**
 * Write `release.json` into a staged service folder: its version and bundle
 * hash. stage-service.sh runs it last, so the stamp covers the Dockerfile.
 */
import { writeFileSync as write_file_sync } from 'node:fs'
import { join } from 'node:path'
import { RELEASE_FILE, stamp_of } from '#root/lib/release.js'

const [stage] = process.argv.slice(2)
if (!stage) throw new Error('usage: release-stamp.js <staged folder>')
const stamp = stamp_of(stage)
write_file_sync(join(stage, RELEASE_FILE), `${JSON.stringify(stamp)}\n`)
process.stdout.write(`${stamp.version} ${stamp.bundle}\n`)
