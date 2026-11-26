/**
 * k3: every file an actor returns waits in quarantine, never in place.
 * The bytes go to `people/<owner>/quarantine/<actor>/<path>`, and one item on
 * `people/<owner>/quarantine/Waiting.html` says what the actor meant to do.
 * The Mac reads that page, checks each change, and moves the ones that pass.
 */
import { item_html } from '#root/lib/items.js'
import { prepend_item } from './page-list.js'

/** The page of waiting changes, beside the actors' folders. */
export const WAITING_PAGE = 'Waiting.html'

/** Items the page keeps; the oldest drop off. */
const KEPT = 500

const HEAD = `<!doctype html>
<html lang="en" itemscope itemtype="https://schema.org/WebPage">
<head><meta charset="utf-8" /><title>Waiting changes</title></head>
<body><main>
<h1 itemprop="name">Waiting changes</h1>
<p>Files actors returned, newest first. They wait here for the Mac's checks.</p>
`
const TAIL = `</main></body>
</html>
`

/**
 * The name an actor's folder takes: its own id, else the phone on its pass.
 * @param {{ id?: string, harness?: string, recovery?: string, phone?: string } | null} who
 */
export const actor_of = who =>
  who?.id ?? who?.harness ?? who?.recovery ?? who?.phone ?? null

/**
 * An actor's pass: an agent working for a person, not the person, and not the
 * halo host that publishes its sites.
 * @param {{ harness?: string, recovery?: string } | null} who
 */
export const is_actor = who => Boolean(who?.harness || who?.recovery)

/**
 * The owner and path an actor's change aims at, or null when it is not a
 * change to a person's own files.
 * @param {string} path
 * @param {string} action
 */
export const owned_target = (path, action) => {
  if (action !== 'write' && action !== 'delete') return null
  const found = /^people\/(\+\d+)\/(.+)$/.exec(path)
  if (!found || found[2].startsWith('quarantine/')) return null
  return { owner: found[1], rest: found[2] }
}

/**
 * Keep one actor change in quarantine, and list it on the waiting page.
 * @param {{ storage: import('./server.js').SyncStorage, owner: string, rest: string, action: string, who: { id?: string, harness?: string, recovery?: string, phone?: string } | null, body?: Buffer | null, packed?: boolean, base?: string | null, at?: string }} change
 * @returns {Promise<string>} the key the bytes wait at
 */
export const hold_change = async ({
  storage,
  owner,
  rest,
  action,
  who,
  body = null,
  packed = false,
  base = null,
  at = new Date().toISOString()
}) => {
  const actor = actor_of(who)
  const key = `people/${owner}/quarantine/${actor}/${rest}`
  const held_version =
    action === 'write' && body
      ? await storage.put(key, body, packed ? { encoding: 'gzip' } : {})
      : null
  await prepend_item({
    storage,
    key: `people/${owner}/quarantine/${WAITING_PAGE}`,
    head: HEAD,
    tail: TAIL,
    type: 'change',
    kept: KEPT,
    item: item_html('change', {
      path: rest,
      action,
      actor,
      base: base ?? 'new',
      held: action === 'write' ? key : 'nothing kept',
      held_version: held_version ?? '',
      at
    })
  })
  return key
}
