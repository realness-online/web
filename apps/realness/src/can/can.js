import { has_escape, unsafe_part } from '#root/lib/path-parts.js'
/**
 * can(who, action, path, grants): the one rights engine.
 *
 * who     null for a stranger, `{ phone: "+A" }` for a person,
 *         `{ instance: "/+A/harnesses/<id>" }` for a harness instance,
 *         `{ halo_name: "realness-1" }` for a halo holding a record pass,
 *         `{ gate: "realness-1" }` for the gate that may wake that halo.
 *         `member_of` on who lists the orgs the caller is in, for grants
 *         naming an org.
 * action  "get", "list", "write", or "delete".
 * path    a storage key: `people/+A/...`, `subscriptions/+A/...`, `usage/+A/...`, `billing/+A/...`,
 *         `loops/<id>/...`, or `halos/<name>/...`.
 * grants  triples read from the owner's rights page (see rights.js). A grantee is
 *         `/+A/harnesses/<id>` for a harness, `/+name` for an org, or `commons`.
 * org     for `orgs/+name/...`: `{ founder, members }` from that org's
 *         members page (see members.js), or null when it has none.
 *
 * Deny by default. Ownership comes from the path, never from stored data.
 * Lessons carried over from Realness `storage.rules` are in test/can.test.js.
 */

const ACTIONS = new Set(['get', 'list', 'write', 'delete'])
const PHONE = /^\+[1-9]\d{6,14}$/

/**
 * A path a person's folder can hold: `people/<phone>/...`.
 * @param {string} path
 */
export const is_person_path = path => {
  const [top, owner] = path.split('/')
  return top === 'people' && PHONE.test(owner ?? '')
}
const INSTANCE = /^\/(\+[1-9]\d{6,14})\/harnesses\/([\w.-]+)$/
const HALO = /^[a-z0-9][a-z0-9-]{0,62}$/
const LOOP = /^a-[a-f0-9]{12}$/
/** An org's name is its id, `+family`; it never changes once made. */
const ORG = /^\+[a-z][a-z0-9-]{0,62}$/
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
      (action === 'get'
        ? file === 'lifecycle.html' || file === 'status.html'
        : file === 'lifecycle.html')
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

/** A grantee naming an org, `/+name`, or the commons, `commons`. */
const ORG_GRANTEE = /^\/\+[a-z][a-z0-9-]{0,62}$/
const COMMONS = 'commons'

/**
 * One permission read from a rights page.
 * @typedef {{ action: string, grantee: string, path: string }} Grant
 */

/**
 * The org a grantee names, `commons` for anyone, or null.
 * @param {string} grantee
 * @returns {string | null}
 */
export const grantee_org = grantee => {
  if (grantee === COMMONS) return COMMONS
  return ORG_GRANTEE.test(grantee ?? '') ? grantee.slice(1) : null
}

/**
 * A grant covers this path for the harness the owner runs, for a member of
 * the org it names, or for anyone when it names the commons. Writing what the
 * commons was granted needs a signed-in person.
 * @param {string} action
 * @param {string} owner
 * @param {string[]} parts
 * @param {{ owner?: string, id?: string, phone?: string, member_of: string[] }} me
 * @param {Grant[]} grants
 */
const granted = (action, owner, parts, me, grants) => {
  const own_harness = Boolean(me.id) && me.owner === owner
  if (own_harness && parts[2] === 'harnesses' && parts[3] === me.id) return true
  if (parts.slice(2).join('/') === 'rights.html') return false
  const key = parts.join('/')
  const instance = own_harness ? `/${me.owner}/harnesses/${me.id}` : null
  return (Array.isArray(grants) ? grants : []).some(grant => {
    if (!GRANTED[grant?.action]?.has(action) || !covers(grant, owner, key))
      return false
    if (instance && grant.grantee === instance) return true
    const org = grantee_org(grant.grantee)
    if (org === COMMONS) return action !== 'write' || Boolean(me.phone)
    if (!me.phone && !me.owner) return false
    return typeof org === 'string' && me.member_of.includes(org)
  })
}

/** st2: stored under a person, reached only as `usage/+A/...` and the like. */
const PERSONAL_FOLDERS = new Set(['usage', 'billing', 'subscriptions'])

const people_allowed = (action, owner, rest, me, grants) => {
  if (!owner) return action === 'list' && Boolean(me.phone)
  if (!PHONE.test(owner)) return false
  if (PERSONAL_FOLDERS.has(rest[0])) return false
  if (me.phone === owner) return true
  if (is_public(action, rest)) return true
  return granted(action, owner, ['people', owner, ...rest], me, grants)
}

/**
 * Members of an org read, list, and write its files; only the founder
 * deletes. Only the founder writes a members page, at the top or in a
 * subfolder; `org.members` is already narrowed along the path (sh2, sh3). Only a global admin
 * starts an org, by writing its first members page, and sync checks that
 * the page names them as founder. Being an admin opens no org's files.
 */
const orgs_allowed = (action, name, rest, me, org) => {
  if (!me.phone || !ORG.test(name ?? '')) return false
  if (rest.at(-1) === 'members.html') {
    if (!org) return rest.length === 1 && action === 'write' && me.admin
    if (action === 'get') return org.members.includes(me.phone)
    return action === 'write' && org.founder === me.phone
  }
  if (!org?.members.includes(me.phone)) return false
  return action !== 'delete' || org.founder === me.phone
}

/**
 * sy15: `trash/people/+A/` is yours and `trash/orgs/+name/` the founder's,
 * to read, list, and empty. Nobody writes it; sync files deletes there.
 */
const trash_allowed = (action, kind, rest, me, org) => {
  const [owner] = rest
  if (!me.phone || !['get', 'list', 'delete'].includes(action)) return false
  if (kind === 'people') return owner === me.phone
  return kind === 'orgs' && ORG.test(owner ?? '') && org?.founder === me.phone
}

/**
 * @param {{ founder: string | null, members: string[] } | null} [org] the path's org
 */
export const can = (who, action, path, grants = [], org = null) => {
  if (!ACTIONS.has(action)) return false
  const parts = segments(path)
  if (!parts) return false
  const me = {
    ...subject(who),
    member_of: Array.isArray(who?.member_of) ? who.member_of : []
  }
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
  if (root === 'orgs') return orgs_allowed(action, owner, rest, me, org)
  if (root === 'trash') return trash_allowed(action, owner, rest, me, org)
  if (root === 'usage') return owns_row(action, owner, me)
  if (root === 'billing') return owns_row(action, owner, me)
  if (root !== 'people') return false
  return people_allowed(action, owner, rest, me, grants)
}
