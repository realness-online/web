import { item_html, read_item } from '#root/lib/items.js'

export const ACTOR_ACTIONS = new Set(['idle', 'stop'])
export const request_key = (halo, actor) =>
  `halos/${halo}/requests/${actor}.html`

export const request_html = ({ id, action, requested }) => {
  if (!ACTOR_ACTIONS.has(action))
    throw new Error(`unknown actor action ${action}`)
  return item_html('request', { id, action, requested })
}

/** The request, or null for anything malformed. */
export const read_request = html => {
  const values = read_item(String(html), 'request')
  if (
    !values?.id ||
    !ACTOR_ACTIONS.has(values.action) ||
    !Number.isFinite(Date.parse(values.requested))
  )
    return null
  return values
}
