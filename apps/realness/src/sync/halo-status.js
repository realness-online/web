const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/**
 * One halo record as `{ halo, actors, apps }`; unknown fields are ignored.
 * Records written under the older `/halo` name still read, as `halo`.
 * @typedef {Record<string, string>} StatusFields
 * @param {string} html
 * @returns {{ halo: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }}
 */
export const read_status = html => {
  /** @type {{ halo: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }} */
  const read = { halo: null, actors: [], apps: [] }
  for (const [, type, body] of html.matchAll(
    /<article itemscope itemtype="\/(halo|actor|app)">(.*?)<\/article>/g
  )) {
    /** @type {StatusFields} */
    const values = {}
    for (const [, name, value] of body.matchAll(
      /itemprop="(\w+)" content="([^"]*)"/g
    ))
      values[name] = unesc(value)
    if (type === 'halo') read.halo = values
    else read[`${type}s`].push(values)
  }
  return read
}
