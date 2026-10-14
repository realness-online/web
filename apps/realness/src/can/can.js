import { has_escape, unsafe_part } from '#root/lib/path-parts.js'
/**
 * can(who, action, path, grants): the one rights engine.
 *
 * who     null for a stranger, `{ phone: "+A" }` for a person,
 *         `{ instance: "/+A/harnesses/<id>" }` for a harness instance,
 *         `{ host_name: "brayness-1" }` for a host holding a record pass.
 * action  "get", "list", "write", or "delete".
 * path    a storage key: `people/+A/...`, `subscriptions/+A/...`, `usage/+A/...`, `billing/+A/...`,
 *         `loops/<id>/...`, or `hosts/<name>/...`.
 * grants  triples read from the owner's rights page (see rights.js).
 *
 * Deny by default. Ownership comes from the path, never from stored data.
 * Lessons carried over from Realness `storage.rules` are in test/can.test.js.
 */

const ACTIONS = new Set(['get', 'list', 'write', 'delete'])
const PHONE = /^\+[1-9]\d{6,14}$/
const INSTANCE = /^\/(\+[1-9]\d{6,14})\/harnesses\/([\w.-]+)$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/
const LOOP = /^a-[a-f0-9]{12}$/
const PUBLIC_FILES = new Set(['index.html.gz'])
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
  if (typeof who.host_name === 'string' && HOST.test(who.host_name))
    return { host: who.host_name }
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

export const can = (who, action, path, grants = []) => {
  if (!ACTIONS.has(action)) return false
  const parts = segments(path)
  if (!parts) return false
  const me = subject(who)
  const [root, owner, ...rest] = parts

  if (root === 'subscriptions') return Boolean(owner) && me.phone === owner
  if (root === 'loops') {
    const file = LOOP.test(owner ?? '') ? rest.join('/') : null
    if (me.host)
      return (
        (action === 'write' && file === 'record.html') ||
        (action === 'get' && file === 'stop.html')
      )
    if (!me.admin) return false
    if (action === 'get' || action === 'list') return true
    return action === 'write' && file === 'stop.html'
  }
  if (root === 'hosts') {
    const file = rest.join('/')
    const request =
      rest.length === 2 &&
      rest[0] === 'requests' &&
      /^a-[a-f0-9]{12}\.html$/.test(rest[1])
    if (me.host) {
      if (owner !== me.host) return false
      if (file === 'status.html') return action === 'write' || action === 'get'
      return request && action === 'get'
    }
    if (me.admin !== true) return false
    if (action === 'get' || action === 'list') return true
    return action === 'write' && request
  }
  if (root === 'usage')
    return (
      (action === 'get' || action === 'list') &&
      (me.admin || (Boolean(owner) && me.phone === owner))
    )
  if (root === 'billing')
    return (
      (action === 'get' || action === 'list') &&
      (me.admin || (Boolean(owner) && me.phone === owner))
    )

  if (root !== 'people') return false
  if (!owner) return action === 'list' && Boolean(me.phone)
  if (!PHONE.test(owner)) return false
  if (me.phone === owner) return true
  if (is_public(action, rest)) return true
  if (me.owner !== owner) return false

  if (rest[0] === 'harnesses' && rest[1] === me.id) return true
  if (rest.join('/') === 'rights.html') return false
  const key = parts.join('/')
  const instance = `/${me.owner}/harnesses/${me.id}`
  return (Array.isArray(grants) ? grants : []).some(
    grant =>
      grant?.grantee === instance &&
      GRANTED[grant.action]?.has(action) &&
      covers(grant, owner, key)
  )
}
