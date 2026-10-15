const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/**
 * One host record as `{ host, actors, apps }`; unknown fields are ignored.
 * @typedef {Record<string, string>} StatusFields
 * @param {string} html
 * @returns {{ host: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }}
 */
export const read_status = html => {
  /** @type {{ host: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }} */
  const read = { host: null, actors: [], apps: [] }
  for (const [, type, body] of html.matchAll(
    /<article itemscope itemtype="\/(host|actor|app)">(.*?)<\/article>/g
  )) {
    /** @type {StatusFields} */
    const values = {}
    for (const [, name, value] of body.matchAll(
      /itemprop="(\w+)" content="([^"]*)"/g
    ))
      values[name] = unesc(value)
    if (type === 'host') read.host = values
    else read[`${type}s`].push(values)
  }
  return read
}
