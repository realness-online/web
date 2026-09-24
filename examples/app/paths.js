// itemid to storage path, and the directory id the store caches by. The shape
// is the `Paths` seam `@realness/store` asks for.
//
//   /+me/notes/1758000000000  ->  people/+me/notes/1758000000000.html
//   directory id                   /+me/notes/
import { as_author, as_created_at, as_type } from './itemid.js'

const PEOPLE = 'people'

/**
 * @param {string} itemid
 * @returns {string}
 */
export const directory_id = itemid => `${as_author(itemid)}/${as_type(itemid)}/`

export const paths = {
  storage_path: itemid => `${PEOPLE}${itemid}.html`,
  directory_id,
  directory_path: itemid => `${PEOPLE}${directory_id(itemid)}`,
  archive_path: (itemid, archive_id) =>
    `${PEOPLE}${as_author(itemid)}/${as_type(itemid)}/${archive_id}/${as_created_at(itemid)}.html`,
  created_at_from_filename: name => {
    const created = parseInt(name)
    return Number.isNaN(created) ? null : created
  },
  files: itemid => Promise.resolve([`${PEOPLE}${itemid}.html`]),
  siblings: () => []
}