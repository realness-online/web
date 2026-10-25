/**
 * sy15: where a deleted file is kept, and where a kept file came from.
 * Shared by sync, which keeps it, and the client, which restores it.
 */
/** `YYYY-MM-DD` and `HH:MM:SS.mmm` inside an ISO time. */
const DAY_END = 10
const TIME_START = 11
const TIME_END = 23
const TRASHED = /^(people|orgs)\/(\+[^/]+)\/(.+)$/
const IN_TRASH =
  /^trash\/(people|orgs)\/(\+[^/]+)\/(\d{4}-\d{2}-\d{2})\/(\d{9})\/(.+)$/

/** The trash day a time falls on, `YYYY-MM-DD`. */
export const trash_day = now => now.toISOString().slice(0, DAY_END)

/** The owner's trash folder a kept key sits in. */
export const trash_owner = key =>
  key.replace(/^(trash\/[^/]+\/[^/]+\/).*$/, '$1')

/** Where a deleted file goes, or null when its tree has no trash. */
export const trash_key = (path, now = new Date()) => {
  const match = TRASHED.exec(path)
  if (!match) return null
  const [, root, owner, rest] = match
  const iso = now.toISOString()
  const time = iso.slice(TIME_START, TIME_END).replace(/[:.]/g, '')
  return `trash/${root}/${owner}/${trash_day(now)}/${time}/${rest}`
}

/** Where a trashed file came from, or null for any other key. */
export const trashed_from = key => {
  const match = IN_TRASH.exec(key)
  return match ? `${match[1]}/${match[2]}/${match[5]}` : null
}
