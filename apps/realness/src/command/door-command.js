/**
 * `realness door`: one pass of the Mac's door - pull the cloud both ways and
 * admit what waits. A turn of the harness runs this on its own; the command is
 * here for a person who wants the pull without an agent.
 */
import { join } from 'node:path'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { flush_marks } from '#root/src/can/marks.js'
import { store_of } from '#root/src/can/store.js'
import { state_dir, trash_dir } from '#root/src/files/client.js'
import { mac_door } from '#root/src/files/mac-door.js'
import { local_owner } from '#root/src/files/target.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { person_settings } from '#root/src/settings/environments.js'

/**
 * @param {string[]} args
 * @param {{ stdout?: NodeJS.WritableStream, root?: string, phone?: string, store?: any, door?: typeof mac_door }} [options]
 */
export const run_door = async (
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
    ),
    door = mac_door
  } = {}
) => {
  if (!phone) {
    stdout.write('door: no owner on this machine\n')
    return 1
  }
  const record = join(state_dir(root), 'two-way.json')
  const trash = trash_dir(use_harness_state(root))
  const { pulled, admitted } = await door({ root, store, phone, record, trash })
  await flush_marks()
  stdout.write(
    `door: pulled ${pulled.pulled.length}, moved ${admitted.moved.length}, ` +
      `waiting ${admitted.waiting.length}\n`
  )
  return 0
}
