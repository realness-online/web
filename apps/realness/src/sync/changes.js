/**
 * A change feed per person, so a client learns what moved without listing
 * every file (h3). Each write through sync leaves one empty object whose name
 * carries the whole change, so one listing reads many changes:
 *
 *   changes/<phone>/<iso time>~<random>~<base64url path>~<version or ->
 *
 * The path is relative to `people/<phone>/`. Records live 7 days (bucket
 * lifecycle); a cursor older than that gets 410 and walks instead.
 */
import { randomBytes as random_bytes } from "node:crypto"

export const RETENTION_MS = 6 * 24 * 60 * 60 * 1000
/** A write in flight when the cursor was taken lands just behind it; reads look back this far. */
export const OVERLAP_MS = 5 * 1000
const PERSON = /^people\/(\+[1-9]\d{6,14})\/(.+)$/

const encode = (text) => Buffer.from(text).toString("base64url")
const decode = (text) => Buffer.from(text, "base64url").toString("utf8")

/** Record one write (`version`) or delete (null) under `people/<phone>/`. */
export const record_change = async (storage, path, version, { now = Date.now } = {}) => {
  const match = PERSON.exec(path)
  if (!match) return
  const [, phone, rest] = match
  const name = `${new Date(now()).toISOString()}~${random_bytes(3).toString("hex")}~${encode(rest)}~${version ?? "-"}`
  await storage.put(`changes/${phone}/${name}`, "")
}

/**
 * Changes under `folder` (a `people/<phone>/...` path) since `cursor`.
 * Returns `{ cursor, changes: { name: version | null } }`, later records
 * winning, or null when the cursor is too old to trust.
 */
export const read_changes = async (storage, folder, cursor, { now = Date.now } = {}) => {
  const match = PERSON.exec(folder)
  if (!match) return null
  const [, phone, rest] = match
  const at = now()
  const next = new Date(at).toISOString()
  if (!cursor) return { cursor: next, changes: {} }
  const since = Date.parse(cursor)
  if (!Number.isFinite(since) || at - since > RETENTION_MS) return null
  const after = new Date(since - OVERLAP_MS).toISOString()
  const changes = {}
  for (const name of await storage.list_after(`changes/${phone}/`, after)) {
    const [, , path, version] = name.split("~")
    if (!path) continue
    const full = decode(path)
    if (!full.startsWith(rest)) continue
    changes[full.slice(rest.length)] = version === "-" ? null : version
  }
  return { cursor: next, changes }
}
