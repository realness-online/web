import { read_items } from '#root/lib/items.js'

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
  read.halo = read_items(html, 'halo').at(-1) ?? null
  read.actors = read_items(html, 'actor')
  read.apps = read_items(html, 'app')
  return read
}
