/**
 * G6: the Mac's door. A hash changes, this pulls the cloud's `vault/` and
 * `quarantine/` down both ways, then admits what waits, so a change lands in the
 * Mac's vault with no command run. The Mac's `quarantine/` folder is the store's
 * `people/<phone>/quarantine/`, so the admit reads the same paths both sides use.
 */
import { admit } from '#root/src/files/admit.js'
import { two_way } from '#root/src/files/two-way.js'
import { owner_store } from '#root/src/files/local-admit.js'

/**
 * One pass: pull, then admit.
 *
 * The admit reads the cloud's quarantine, not the Mac's copy, so the queue has
 * one writer at a time and a change cleared here is cleared there. The Mac's
 * `quarantine/` folder is the inbox the local server fills; the pull keeps it
 * in step.
 * @param {{ root: string, store: any, phone: string, record: string, trash: string, folders?: string[], run?: typeof admit }} pass
 */
export const mac_door = async ({
  root,
  store,
  phone,
  record,
  trash,
  folders,
  run = admit
}) => {
  const pulled = await two_way({ root, store, phone, record, folders })
  const admitted = await run({
    root,
    store: owner_store(store, phone),
    phone,
    trash
  })
  return { pulled, admitted }
}
