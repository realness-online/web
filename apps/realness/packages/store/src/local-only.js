import { as_path_parts } from '@realness.online/itemid'

/**
 * A backend and paths for apps that keep everything in the browser.
 * Nothing leaves the device: the backend is never online or signed in, so
 * Cloud mixins fall back to local saves and Directory reads return empty.
 *
 *   create_store({ ...local(), vocabulary })
 */

const offline = () => {
  throw new Error('@realness.online/store/local has no network backend')
}

const as_path = itemid => itemid.replace(/^\//, '')

const directory_id = itemid => {
  const [author, type, , archive] = as_path_parts(itemid)
  if (archive && archive !== 'index') return `/${author}/${type}/${archive}/`
  return `/${author}/${type}/`
}

/** @returns {import('./store.js').Backend} */
export const local_backend = () => ({
  upload: offline,
  remove: () => Promise.resolve(),
  move: () => Promise.resolve(false),
  url: path => Promise.resolve(path),
  directory: () => Promise.resolve({ items: [], prefixes: [] }),
  online: () => false,
  signed_in: () => false
})

/** @returns {import('./store.js').Paths} */
export const local_paths = () => ({
  storage_path: itemid => Promise.resolve(`${as_path(itemid)}.html`),
  directory_id,
  directory_path: itemid => as_path(directory_id(itemid)),
  archive_path: (itemid, archive_id) => {
    const [author, type, created] = as_path_parts(itemid)
    return `${author}/${type}/${archive_id}/${created}`
  },
  created_at_from_filename: name => {
    const created = parseInt(name.split('.')[0])
    return Number.isNaN(created) ? null : created
  },
  files: itemid => Promise.resolve([`${as_path(itemid)}.html`]),
  siblings: () => []
})

export const local = () => ({
  backend: local_backend(),
  paths: local_paths()
})
