/**
 * `realness door`: one sync by hand, the same check a turn runs. It reads the
 * hash pages, opens only the folders that moved, then admits what waits.
 */
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { flush_marks } from '#root/src/can/marks.js'
import { store_of } from '#root/src/can/store.js'
import { turn_at } from '#root/src/files/sync-check.js'
import { local_owner } from '#root/src/files/target.js'
import { find_root } from '#root/src/harness/harness.js'
import { person_settings } from '#root/src/settings/environments.js'

/**
 * @param {string[]} _args
 * @param {{ stdout?: NodeJS.WritableStream, root?: string, phone?: string, store?: any, turn?: typeof turn_at }} [options]
 */
export const run_door = async (
  _args,
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
    ),
    turn = turn_at
  } = {}
) => {
  if (!phone) {
    stdout.write('door: no owner on this machine\n')
    return 1
  }
  const line = await turn({
    root,
    phone,
    store,
    on_start: folders => stdout.write(`door: opening ${folders.join(', ')}\n`)
  })
  await flush_marks()
  stdout.write(`${line ?? 'door: nothing changed'}\n`)
  return 0
}
