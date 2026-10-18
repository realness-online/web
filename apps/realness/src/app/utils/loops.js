const FORBIDDEN = 403
const ALREADY_STOPPING = 412

const FIELDS = [
  'id',
  'owner',
  'parent',
  'depth',
  'status',
  'reason',
  'runs',
  'tokens',
  'started',
  'ended',
  'checked',
  'error'
]

/**
 * One `/loop` item back into an object.
 * @returns {Record<string, string> | null}
 */
export const read_loop = html => {
  const item = new DOMParser()
    .parseFromString(html, 'text/html')
    .querySelector('[itemtype="/loop"]')
  if (!item) return null
  /** @type {Record<string, string>} */
  const loop = {
    goal: item.querySelector('[itemprop="goal"]')?.textContent ?? ''
  }
  for (const name of FIELDS)
    loop[name] =
      item.querySelector(`meta[itemprop="${name}"]`)?.getAttribute('content') ??
      ''
  return loop
}

/** Every loop on every halo, running first, then newest. 403: not an admin. */
export const list_loops = async token => {
  const headers = { authorization: `Bearer ${token}` }
  const listing = await fetch('/v1/loops/?deep', { headers })
  if (listing.status === FORBIDDEN)
    throw new Error(
      'This number is not a Realness admin. Ask an admin to run: ' +
        'realness <environment> admins add <your phone> --yes'
    )
  if (!listing.ok) throw new Error(`Could not list loops (${listing.status})`)
  const keys = Object.keys(await listing.json())
  const stop_requested = new Set(
    keys.filter(key => key.endsWith('/stop.html')).map(key => key.split('/')[0])
  )
  const records = keys.filter(key => key.endsWith('/record.html'))
  const loops = await Promise.all(
    records.map(async key => {
      const response = await fetch(`/v1/loops/${key}`, { headers })
      const loop = response.ok ? read_loop(await response.text()) : null
      return loop && { ...loop, stop_requested: stop_requested.has(loop.id) }
    })
  )
  /** @param {Record<string, any>} loop */
  const running = loop => (loop.status === 'running' ? 0 : 1)
  return loops
    .filter(loop => loop !== null)
    .sort(
      (
        /** @type {Record<string, any>} */ a,
        /** @type {Record<string, any>} */ b
      ) =>
        running(a) - running(b) ||
        String(b.started).localeCompare(String(a.started))
    )
}

/** Ask the loop's halo to stop it on its next probe. */
export const stop_loop = async (token, id) => {
  const response = await fetch(`/v1/loops/${id}/stop.html`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'if-none-match': '*' },
    body: `<p>Stop requested ${new Date().toISOString()}</p>`
  })
  if (!response.ok && response.status !== ALREADY_STOPPING)
    throw new Error(`Could not stop ${id} (${response.status})`)
}
