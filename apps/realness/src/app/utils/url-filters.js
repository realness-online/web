/**
 * Filter state lives in the link's query, so a filtered view reloads and
 * shares. A list keeps its order; an empty or default value leaves the query.
 */

/**
 * The filter values the current link carries.
 * @param {string} search `location.search`
 * @param {string[]} names
 * @returns {Record<string, string>}
 */
export const read_filters = (search, names) => {
  const params = new URLSearchParams(search)
  return Object.fromEntries(
    names
      .filter(name => params.has(name))
      .map(name => [name, params.get(name) ?? ''])
  )
}

/**
 * Write the filters into the link, without a new history entry.
 * @param {Record<string, string | string[] | boolean | undefined>} filters
 */
export const write_filters = filters => {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(filters))
    if (value === true) params.set(name, '1')
    else if (Array.isArray(value)) params.set(name, value.join(','))
    else if (value) params.set(name, value)
  const query = params.toString()
  const url = location.pathname + (query ? `?${query}` : '') + location.hash
  if (url !== location.pathname + location.search + location.hash)
    history.replaceState(history.state, '', url)
}
