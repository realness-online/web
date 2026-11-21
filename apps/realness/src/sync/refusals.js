/**
 * i0: a write the access check refuses leaves one item on the owner's page,
 * `people/<phone>/vault/Refusals.html`, so the reason survives the request.
 */
import { item_html } from '#root/lib/items.js'
import { actor_of } from './quarantine.js'
import { prepend_item } from './page-list.js'

/** The page the owner reads, by its vault-relative path. */
export const REFUSALS_PAGE = 'Refusals.html'

/** Items the page keeps; the oldest drop off. */
const KEPT = 50

const HEAD = `<!doctype html>
<html lang="en" itemscope itemtype="https://schema.org/WebPage">
<head><meta charset="utf-8" /><title>Refused writes</title></head>
<body><main>
<h1 itemprop="name">Refused writes</h1>
<p>A write the access check refused, newest first.</p>
`
const TAIL = `</main></body>
</html>
`

/** The item one refusal adds. `held` is where the bytes wait, when they were kept. */
const refusal_html = ({ path, action, who, reason, at, held }) =>
  item_html('refusal', {
    path,
    action,
    who: who ?? 'signed out',
    reason,
    at,
    held: held ?? 'not kept'
  })

/**
 * Why a write was refused, in words the owner can read.
 * @param {{ action: string, who: { phone?: string, harness?: string } | null }} call
 */
const reason_of = ({ action, who }) =>
  who?.phone || who?.harness
    ? `the access check does not allow ${action}`
    : 'not signed in'

/**
 * Add one refusal to the owner's page. A guarded write means two refusals
 * racing still leave both items.
 * @param {{ storage: import('./server.js').SyncStorage, owner: string, entry: { path: string, action: string, who: { phone?: string, harness?: string } | null, at?: string, held?: string | null } }} options
 */
export const keep_refusal = ({ storage, owner, entry }) =>
  prepend_item({
    storage,
    key: `people/${owner}/vault/${REFUSALS_PAGE}`,
    head: HEAD,
    tail: TAIL,
    type: 'refusal',
    kept: KEPT,
    item: refusal_html({
      path: entry.path,
      action: entry.action,
      who: entry.who?.phone ?? entry.who?.harness ?? null,
      reason: reason_of(entry),
      at: entry.at ?? new Date().toISOString(),
      held: entry.held
    })
  })

/**
 * k1: the bytes of a refused write wait in `people/<owner>/quarantine/<actor>/`
 * at the path they were meant for. They never reach the vault. A stranger's
 * write is not kept.
 * @param {{ storage: import('./server.js').SyncStorage, body: Buffer, packed?: boolean, path: string, owner: string, who: { phone?: string, harness?: string } | null }} call
 * @returns {Promise<string | null>} the key the bytes wait at, or null
 */
export const hold_refused = async ({
  storage,
  body,
  packed,
  path,
  owner,
  who
}) => {
  const actor = actor_of(who)
  const inside = `people/${owner}/`
  if (!actor || !path.startsWith(inside)) return null
  const rest = path.slice(inside.length)
  if (!rest || rest.startsWith('quarantine/')) return null
  const key = `${inside}quarantine/${actor}/${rest}`
  await storage.put(key, body, packed ? { encoding: 'gzip' } : {})
  return key
}
