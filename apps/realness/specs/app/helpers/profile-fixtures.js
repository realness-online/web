/**
 * Minimal profile HTML aligned with `as-address` / microdata parsing in `get_item`.
 * @param {{ id: string, name: string, visited?: string, avatar?: string }} p
 * @returns {string}
 */
export const address_html_for_person = p => {
  const avatar_link = p.avatar
    ? `<link itemprop="avatar" rel="icon" href="${p.avatar}" />`
    : ''
  const visited_meta = p.visited
    ? `<meta itemprop="visited" content="${p.visited}" />`
    : ''
  return `<address itemscope itemtype="/person" itemid="${p.id}"><h3 itemprop="name">${p.name}</h3>${avatar_link}${visited_meta}</address>`
}
