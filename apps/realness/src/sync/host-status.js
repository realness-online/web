const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

export const read_status = html => {
  const read = { host: null, actors: [], apps: [] }
  for (const [, type, body] of html.matchAll(
    /<article itemscope itemtype="\/(host|actor|app)">(.*?)<\/article>/g
  )) {
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
