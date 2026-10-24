import { has_escape, unsafe_part } from '#root/lib/path-parts.js'
/**
 * can(who, action, path, grants): the one rights engine.
 *
 * who     null for a stranger, `{ phone: "+A" }` for a person,
 *         `{ instance: "/+A/harnesses/<id>" }` for a harness instance,
 *         `{ halo_name: "realness-1" }` for a halo holding a record pass,
 *         `{ gate: "realness-1" }` for the gate that may wake that halo.
 * action  "get", "list", "write", or "delete".
 * path    a storage key: `people/+A/...`, `subscriptions/+A/...`, `usage/+A/...`, `billing/+A/...`,
 *         `loops/<id>/...`, or `halos/<name>/...`.
 * grants  triples read from the owner's rights page (see rights.js).
 *
 * Deny by default. Ownership comes from the path, never from stored data.
 * Lessons carried over from Realness `storage.rules` are in test/can.test.js.
 */

const ACTIONS = new Set(['get', 'list', 'write', 'delete'])
const PHONE = /^\+[1-9]\d{6,14}$/
const INSTANCE = /^\/(\+[1-9]\d{6,14})\/harnesses\/([\w.-]+)$/
const HALO = /^[a-z0-9][a-z0-9-]{0,62}$/
const LOOP = /^a-[a-f0-9]{12}$/
/** hs-n2: `placements/<phone digits>.html`, written only by the gate. */
const PLACEMENT = /^[1-9]\d{6,14}\.html$/
const PUBLIC_FILES = new Set(['index.html', 'index.html.gz'])
const PUBLIC_FOLDERS = new Set(['posters', 'statements', 'thoughts'])
const GRANTED = { read: new Set(['get', 'list']), write: ACTIONS }

/** Split a storage key into segments, or null if it is not one we accept. */
const segments = path => {
  if (typeof path !== 'string' || path.startsWith('/')) return null
  const parts = path.split('/')
  if (parts.at(-1) === '') parts.pop()
  for (const part of parts)
    if (unsafe_part(part) || has_escape(part)) return null

  return parts.length ? parts : null
}

/** The phone number behind a subject, and the instance id if it is one. */
const subject = who => {
  if (!who) return {}
  if (typeof who.phone === 'string' && PHONE.test(who.phone))
    return { phone: who.phone, admin: who.admin === true }
  const match = typeof who.instance === 'string' && who.instance.match(INSTANCE)
  if (match) return { owner: match[1], id: match[2] }
  const { halo_name: halo } = who
  if (typeof halo === 'string' && HALO.test(halo)) return { halo }
  if (typeof who.gate === 'string' && HALO.test(who.gate))
    return { gate: who.gate }
  return {}
}

/** Anyone, signed in or not, may read this. */
const is_public = (action, [first, ...inside]) => {
  if (action === 'list') return PUBLIC_FOLDERS.has(first)
  if (action !== 'get') return false
  return inside.length ? PUBLIC_FOLDERS.has(first) : PUBLIC_FILES.has(first)
}

/** A grant covers a path if it names it, or names a folder above it. */
const covers = (grant, owner, key) => {
  const want = `people/${owner}/`
  const path = grant.path.startsWith('/') ? `people${grant.path}` : ''
  if (!path.startsWith(want) || !segments(path)) return false
  return path.endsWith('/') ? `${key}/`.startsWith(path) : key === path
}

/** A person reads only their own usage or billing row; an admin reads any. */
const owns_row = (action, owner, me) =>
  (action === 'get' || action === 'list') &&
  (me.admin || (Boolean(owner) && me.phone === owner))

const loops_allowed = (action, owner, rest, me) => {
  const file = LOOP.test(owner ?? '') ? rest.join('/') : null
  if (me.halo)
    return (
      (action === 'write' && file === 'record.html') ||
      (action === 'get' && file === 'stop.html')
    )
  if (!me.admin) return false
  if (action === 'get' || action === 'list') return true
  return action === 'write' && file === 'stop.html'
}

const halos_allowed = (action, owner, rest, me) => {
  const file = rest.join('/')
  const request =
    rest.length === 2 &&
    rest[0] === 'requests' &&
    /^a-[a-f0-9]{12}\.html$/.test(rest[1])
  if (me.gate)
    return (
      owner === me.gate &&
      file === 'lifecycle.html' &&
      (action === 'get' || action === 'write')
    )
  if (me.halo) {
    if (owner !== me.halo) return false
    if (file === 'status.html' || file === 'lifecycle.html')
      return action === 'write' || action === 'get'
    return request && action === 'get'
  }
  if (me.admin !== true) return false
  if (action === 'get' || action === 'list') return true
  return action === 'write' && (request || file === 'lifecycle.html')
}

/** A grant covers this path, from a harness the same person owns. */
const granted = (action, owner, parts, me, grants) => {
  if (parts[2] === 'harnesses' && parts[3] === me.id) return true
  if (parts.slice(2).join('/') === 'rights.html') return false
  const key = parts.join('/')
  const instance = `/${me.owner}/harnesses/${me.id}`
  return (Array.isArray(grants) ? grants : []).some(
    grant =>
      grant?.grantee === instance &&
      GRANTED[grant.action]?.has(action) &&
      covers(grant, owner, key)
  )
}

const people_allowed = (action, owner, rest, me, grants) => {
  if (!owner) return action === 'list' && Boolean(me.phone)
  if (!PHONE.test(owner)) return false
  if (me.phone === owner) return true
  if (is_public(action, rest)) return true
  if (me.owner !== owner) return false
  return granted(action, owner, ['people', owner, ...rest], me, grants)
}

export const can = (who, action, path, grants = []) => {
  if (!ACTIONS.has(action)) return false
  const parts = segments(path)
  if (!parts) return false
  const me = subject(who)
  const [root, owner, ...rest] = parts

  if (root === 'subscriptions') return Boolean(owner) && me.phone === owner
  if (root === 'loops') return loops_allowed(action, owner, rest, me)
  if (root === 'halos') return halos_allowed(action, owner, rest, me)
  if (root === 'placements')
    return (
      Boolean(me.gate) &&
      rest.length === 0 &&
      PLACEMENT.test(owner ?? '') &&
      (action === 'get' || action === 'write')
    )
  if (root === 'usage') return owns_row(action, owner, me)
  if (root === 'billing') return owns_row(action, owner, me)
  if (root !== 'people') return false
  return people_allowed(action, owner, rest, me, grants)
}
