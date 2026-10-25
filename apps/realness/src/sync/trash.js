/**
 * sy15: deletes go to a trash, not away. Before sync removes a person's or
 * an org's file, it copies the bytes to
 *
 *   trash/people/+A/<day>/<time>/<path>
 *   trash/orgs/+name/<day>/<time>/<path>
 *
 * outside the synced trees, so no walk sees it and no client pulls it down.
 * Only the owner, or the org's founder, reads, lists, or empties it; nobody
 * writes it but sync. A restore puts the file back where it was. Days older
 * than KEEP_DAYS are emptied at most once an hour per owner, on a delete.
 */
import { Conflict } from '#root/src/can/contract.js'
import { trash_day, trash_key, trash_owner } from '#root/src/can/trash-keys.js'

export const KEEP_DAYS = 30
const DAY_MS = 86_400_000
const SWEEP_MS = 3_600_000

/**
 * Keep a file before it is deleted.
 * @param {{ get: Function, put: Function, list: Function, walk: Function, delete: Function }} storage
 */
export const keeper = storage => {
  const swept = new Map()

  /* eslint-disable no-await-in-loop -- old days empty one file at a time */
  const sweep = async (base, now) => {
    if (now - (swept.get(base) ?? 0) < SWEEP_MS) return
    swept.set(base, now)
    const oldest = trash_day(new Date(now - KEEP_DAYS * DAY_MS))
    const { folders } = await storage.list(base)
    for (const day of folders.filter(name => name < oldest))
      for (const name of Object.keys(await storage.walk(`${base}${day}/`)))
        await storage.delete(`${base}${day}/${name}`)
  }
  /* eslint-enable no-await-in-loop */

  /**
   * Copy `path` to the trash. A version guard that no longer matches refuses
   * here, before anything is kept or removed.
   */
  return async (path, if_version, now = Date.now()) => {
    const key = trash_key(path, new Date(now))
    if (!key) return
    const file = await storage.get(path)
    if (!file) return
    if (if_version && file.version !== if_version)
      throw new Conflict(`${path} changed`)
    await storage.put(key, file.body, { meta: file.meta ?? {} })
    await sweep(trash_owner(key), now)
  }
}
