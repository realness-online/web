const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

export const ACTOR_ACTIONS = new Set(['idle', 'stop'])
export const request_key = (halo, actor) =>
  `halos/${halo}/requests/${actor}.html`

export const request_html = ({ id, action, requested }) => {
  if (!ACTOR_ACTIONS.has(action))
    throw new Error(`unknown actor action ${action}`)
  const props = Object.entries({ id, action, requested })
    .map(([name, value]) => `<meta itemprop="${name}" content="${esc(value)}">`)
    .join('')
  return `<article itemscope itemtype="/request">${props}</article>\n`
}

/** The request, or null for anything malformed. */
export const read_request = html => {
  const match = String(html).match(
    /<article itemscope itemtype="\/request">(.*?)<\/article>/s
  )
  if (!match) return null
  const values = {}
  for (const [, name, value] of match[1].matchAll(
    /itemprop="(\w+)" content="([^"]*)"/g
  ))
    values[name] = unesc(value)
  if (
    !values.id ||
    !ACTOR_ACTIONS.has(values.action) ||
    !Number.isFinite(Date.parse(values.requested))
  )
    return null
  return values
}
