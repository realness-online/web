/**
 * The published page for an itemid, from the site index, or null when the
 * note is not in any active snapshot.
 * @param {string | null | undefined} itemid
 * @param {typeof fetch} [fetcher]
 * @returns {Promise<string | null>}
 */
export const published_url = async (itemid, fetcher = fetch) => {
  if (!itemid) return null
  try {
    const response = await fetcher('/sites/index.json')
    if (!response.ok) return null
    const sources = await response.json()
    return sources.find(source => source.id === itemid)?.url ?? null
  } catch {
    return null
  }
}
