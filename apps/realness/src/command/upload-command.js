/**
 * `realness upload`: the Mac's files go up to its own lane in the bucket, one
 * way, with the same storage code the sync server uses.
 */
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { flush_marks } from '#root/src/can/marks.js'
import { store_of } from '#root/src/can/store.js'
import { local_owner } from '#root/src/files/target.js'
import { upload } from '#root/src/files/upload.js'
import { find_root } from '#root/src/harness/harness.js'
import { person_settings } from '#root/src/settings/environments.js'

/**
 * @param {string[]} args
 * @param {{ stdout?: NodeJS.WritableStream, root?: string, phone?: string, store?: any }} [options]
 */
export const run_upload = async (
  args,
  {
    stdout = process.stdout,
    root = find_root(),
    phone = local_owner(root),
    store = store_of(
      create_gcs({
        bucket: person_settings.services.bucket,
        token: gcloud_token()
      }),
      { marks: true }
    )
  } = {}
) => {
  const report = await upload({ root, store, phone })
  await flush_marks()
  if (args.includes('--json')) {
    stdout.write(`${JSON.stringify(report)}\n`)
    return 0
  }
  stdout.write(
    `${[
      `pushed: ${report.pushed.length}`,
      ...report.pushed.map(path => `  ${path}`),
      `unchanged: ${report.unchanged.length}`,
      `too big: ${report.too_big.length}`,
      ...report.too_big.map(path => `  ${path}`)
    ].join('\n')}\n`
  )
  return 0
}
