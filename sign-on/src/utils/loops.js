/* Global admin (a1j): hosts mirror each loop to `loops/<id>/record.html`;
   sync lets an admin read them and write `loops/<id>/stop.html`. */

const FIELDS = ['id', 'host', 'owner', 'parent', 'depth', 'status', 'reason', 'runs', 'tokens', 'started', 'ended', 'checked', 'error']

/** One `/loop` item back into an object. */
export const read_loop = html => {
  const item = new DOMParser().parseFromString(html, 'text/html').querySelector('[itemtype="/loop"]')
  if (!item) return null
  const loop = { goal: item.querySelector('[itemprop="goal"]')?.textContent ?? '' }
  for (const name of FIELDS) loop[name] = item.querySelector(`meta[itemprop="${name}"]`)?.getAttribute('content') ?? ''
  return loop
}

/** Every loop on every host, running first, then newest. 403: not an admin. */
export const list_loops = async (sync_url, token) => {
  const headers = { authorization: `Bearer ${token}` }
  const listing = await fetch(`${sync_url}/loops/?deep`, { headers })
  if (listing.status === 403) throw new Error('This number is not a Brayness admin.')
  if (!listing.ok) throw new Error(`Could not list loops (${listing.status})`)
  const keys = Object.keys(await listing.json())
  const stop_requested = new Set(keys.filter(key => key.endsWith('/stop.html')).map(key => key.split('/')[0]))
  const records = keys.filter(key => key.endsWith('/record.html'))
  const loops = await Promise.all(
    records.map(async key => {
      const response = await fetch(`${sync_url}/loops/${key}`, { headers })
      const loop = response.ok ? read_loop(await response.text()) : null
      return loop && { ...loop, stop_requested: stop_requested.has(loop.id) }
    })
  )
  const running = loop => (loop.status === 'running' ? 0 : 1)
  return loops.filter(Boolean).sort((a, b) => running(a) - running(b) || b.started.localeCompare(a.started))
}

/** Ask the loop's host to stop it on its next probe. */
export const stop_loop = async (sync_url, token, id) => {
  const response = await fetch(`${sync_url}/loops/${id}/stop.html`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'if-none-match': '*' },
    body: `<p>Stop requested ${new Date().toISOString()}</p>`
  })
  if (!response.ok && response.status !== 412) throw new Error(`Could not stop ${id} (${response.status})`)
}
