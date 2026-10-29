#!/usr/bin/env node
/**
 * o10: give every object the Firebase SDK wrote a sync version, so sync
 * clients stop downloading it again on every tick. Only metadata changes;
 * the bytes, Firebase's `hash`, and its download tokens stay. Running again
 * skips objects already adopted, so it doubles as the replay step.
 *
 *   GCS_BUCKET=<bucket> [GCS_PREFIX=<prefix/>] node server/sync/bin/adopt-versions.js [--under people/] [--write]
 *
 * Without --write it only counts what it would adopt.
 */
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'

const CONCURRENCY = 8
const args = process.argv.slice(2)
const write = args.includes('--write')
const under_at = args.indexOf('--under')
const under = under_at === -1 ? 'people/' : args[under_at + 1]
const bucket = process.env.GCS_BUCKET
if (!bucket) throw new Error('set GCS_BUCKET')
const prefix = process.env.GCS_PREFIX ?? ''
const store = create_gcs({ bucket, token: gcloud_token(), prefix })

const listed = await store.walk(under)
const pending = Object.entries(listed)
  .filter(([, version]) => !version || version.startsWith('crc32c-'))
  .map(([name]) => `${under}${name}`)
const counts = { files: Object.keys(listed).length, pending: pending.length }
process.stdout.write(
  `gs://${bucket}/${prefix}${under}: ${counts.files} files, ${counts.pending} without a sync version\n`
)
if (!write) {
  process.stdout.write('dry run: nothing written; add --write to adopt\n')
  process.exit(0)
}

/* eslint-disable no-await-in-loop -- a pool: each worker takes the next key in turn */
/** @type {{ adopted: number, skipped: number, conflicts: string[] }} */
const result = { adopted: 0, skipped: 0, conflicts: [] }
let next = 0
const worker = async () => {
  while (next < pending.length) {
    const key = pending[next++]
    try {
      const done = await store.adopt(key)
      if (done?.adopted) result.adopted++
      else result.skipped++
    } catch (error) {
      if (error.code !== 'conflict') throw error
      result.conflicts.push(key)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
process.stdout.write(
  `adopted ${result.adopted}, skipped ${result.skipped}, changed while adopting ${result.conflicts.length}\n`
)
for (const key of result.conflicts) process.stdout.write(`  ${key}\n`)
process.exit(result.conflicts.length ? 1 : 0)
