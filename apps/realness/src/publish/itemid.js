/**
 * Realness's item types, read with the shared Realness rulebook.
 *
 * An itemid is `/+<phone>/<type>/<created>`: who made the item, what it is,
 * and when, in milliseconds. Realness's own types stay valid because the vault
 * holds its posters and thoughts.
 */
import {
  create_itemid,
  types as realness_types
} from '#root/packages/itemid/src/index.js'

/** What the vault and apps hold beyond Realness's types. */
const vault_types = ['plans', 'articles', 'diagrams', 'sources', 'pages']

/**
 * Types Realness makes: their main file lives in Realness, so the vault may
 * hold several copies. Typed as plain strings because `as_type` returns any
 * type name, including the app types that are not listed here.
 * @type {string[]}
 */
export const made_elsewhere = [...realness_types]

export const types = [...realness_types, ...vault_types]

/** Every vault item is minted with its creation time. */
const requires_timestamp = ['posters', 'thoughts', ...vault_types]

const itemid = create_itemid({ types, requires_timestamp })

export const { as_author, as_type, as_created_at, is_itemid } = itemid

/** A new itemid; `created` is milliseconds since the epoch. */
export const mint = (author, type, created) => {
  const id = `${author}/${type}/${created}`
  if (!is_itemid(id)) throw new Error(`not an itemid: ${id}`)
  return id
}
