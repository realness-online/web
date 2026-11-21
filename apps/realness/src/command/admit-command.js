/**
 * `realness admit`: on the Mac, move the changes actors returned that pass
 * the checks into this Mac's files; the rest wait on `vault/Waiting.html`.
 */
import { admit } from '#root/src/files/admit.js'
import { client, trash_dir } from '#root/src/files/client.js'
import { local_owner, sync_target } from '#root/src/files/target.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'

/**
 * This Mac's sync, signed in as its owner.
 * @param {string} phone
 */
const own_store = async phone => {
  const { url, get_token } = await sync_target()
  return client({ url, token: get_token, phone })
}

/**
 * @param {string[]} args
 * @param {{ stdout?: NodeJS.WritableStream, root?: string, phone?: string, store?: any }} [options]
 */
export const run_admit = async (
  args,
  {
    stdout = process.stdout,
    root = find_root(),
    phone = local_owner(root),
    store
  } = {}
) => {
  const report = await admit({
    root,
    phone,
    trash: trash_dir(use_harness_state(root)),
    store: store ?? (await own_store(phone))
  })
  stdout.write(
    `${[
      `moved: ${report.moved.length}`,
      ...report.moved.map(path => `  ${path}`),
      `waiting: ${report.waiting.length}`,
      ...report.waiting.map(path => `  ${path}`)
    ].join('\n')}\n`
  )
  return 0
}
