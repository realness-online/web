import { get, set, keys, del } from 'idb-keyval'

/**
 * Directory listings: one cached row per directory, merged with the local idb
 * scan, refreshed from the backend only when nothing is cached.
 * @param {{ backend: import('./store.js').Backend, paths: import('./store.js').Paths, itemid: import('@realness.online/itemid').Itemid }} config
 */
// oxlint-disable-next-line max-lines-per-function - one factory keeps every seam in view
export const create_directory = ({ backend, paths, itemid }) => {
  const { as_path_parts, as_author, as_type, as_created_at, is_itemid } = itemid

  const online = () => backend.online()
  const can_read = id =>
    backend.can_read ? backend.can_read(id) : backend.signed_in()

  /**
   * @implements {Directory}
   */
  class Directory {
    id = ''

    /**
     * @type {string[]}
     */
    types = []

    /**
     * @type {number[]}
     */
    archive = []

    /**
     * @type {number[]}
     */
    items = []

    /**
     * @param {string} id
     */
    constructor(id) {
      this.id = paths.directory_id(id)
    }
  }

  /**
   * @param {string} str
   * @returns {boolean}
   */
  const is_directory_id = str => {
    if (typeof str !== 'string' || !str.endsWith('/')) return false
    const base_id = str.slice(0, -1)
    if (!is_itemid(base_id)) return false
    return true
  }

  /**
   * Deletes cached Directory rows for one author. Item html keys (no trailing
   * slash) stay.
   * @param {string} author_id
   * @returns {Promise<void>}
   */
  const clear_author_dirs = async author_id => {
    const prefix = `${author_id}/`
    const all_keys = await keys()
    const to_delete = []
    for (const key of all_keys ?? []) {
      if (typeof key !== 'string') continue
      if (!key.startsWith(prefix)) continue
      if (!key.endsWith('/')) continue
      to_delete.push(key)
    }
    await Promise.all(to_delete.map(key => del(key)))
  }

  /**
   * idb key for the archive location map of an author+type:
   * `{ [created_at]: archive_id }`. Archive segments are location only -
   * identity stays the 3-part itemid.
   * @param {string} itemid
   * @returns {string}
   */
  const archive_map_id = itemid =>
    `${as_author(itemid)}/${as_type(itemid)}/archive-map/`

  /**
   * @param {string} itemid
   * @returns {Promise<number | null>}
   */
  const lookup_archive = async itemid => {
    const created = as_created_at(itemid)
    if (!created) return null
    const map = await get(archive_map_id(itemid))
    return map?.[created] ?? null
  }

  /** @type {Promise<Map<string, number[]>> | null} */
  let local_directories_inflight = null

  /**
   * Every locally cached item key grouped by directory id, from one `keys()`
   * pass. Callers running at the same time share one scan; the grouping is
   * dropped the moment it resolves.
   * @returns {Promise<Map<string, number[]>>}
   */
  const local_directories = () => {
    if (local_directories_inflight) return local_directories_inflight
    local_directories_inflight = (async () => {
      try {
        /** @type {Map<string, number[]>} */
        const grouped = new Map()
        const everything = await keys()
        everything?.forEach(key => {
          if (typeof key !== 'string') return
          const created = as_created_at(key)
          if (!created) return
          const path = paths.directory_id(key)
          const items = grouped.get(path)
          if (items) items.push(created)
          else grouped.set(path, [created])
        })
        return grouped
      } finally {
        local_directories_inflight = null
      }
    })()
    return local_directories_inflight
  }

  /**
   * @param {string} itemid
   * @returns {Promise<Directory>}
   */
  const build_local_directory = async itemid => {
    const path = paths.directory_id(itemid)
    const directory = new Directory(path)
    const grouped = await local_directories()
    directory.items = [...(grouped.get(path) ?? [])]
    return directory
  }

  /**
   * Records which archive directory each created_at lives in.
   * @param {string} itemid - Any itemid under the author+type
   * @param {number} archive_id
   * @param {number[]} created_ats
   * @returns {Promise<void>}
   */
  const remember_archive_locations = async (
    itemid,
    archive_id,
    created_ats
  ) => {
    if (!archive_id || !created_ats?.length) return
    const map_key = archive_map_id(itemid)
    const map = (await get(map_key)) || {}
    let changed = false
    created_ats.forEach(created => {
      if (map[created] === archive_id) return
      map[created] = archive_id
      changed = true
    })
    if (changed) await set(map_key, map)

    await backend.after_directory?.(
      created_ats.map(
        created => `${as_author(itemid)}/${as_type(itemid)}/${created}`
      )
    )
  }

  /**
   * @param {string} itemid
   * @returns {Promise<Directory | null>}
   */
  const load_directory_from_network = async itemid => {
    if (itemid.startsWith('/+/')) return null
    if (!online()) return null
    if (!can_read(itemid)) return null

    const [, , , archive = null] = as_path_parts(itemid)
    const path = paths.directory_id(itemid)
    const meta = new Directory(path)

    const folder = await backend.directory(paths.directory_path(itemid))
    const seen_timestamps = new Set()
    folder?.items?.forEach(item => {
      const created = paths.created_at_from_filename(item.name, itemid)
      if (created === null || created === undefined) return
      if (!seen_timestamps.has(created)) {
        seen_timestamps.add(created)
        meta.items.push(created)
      }
    })
    folder?.prefixes?.forEach(prefix =>
      meta.archive.push(parseInt(prefix.name))
    )
    await set(path, meta)
    if (archive)
      await remember_archive_locations(path, parseInt(archive), meta.items)
    return meta
  }

  /**
   * @param {string} itemid
   * @returns {Promise<Directory | null>}
   */
  const as_directory = async itemid => {
    const path = paths.directory_id(itemid)
    const cached = await get(path)
    if (cached) {
      const local_directory = await build_local_directory(itemid)
      const local_items = local_directory?.items ?? []
      const cached_items = cached.items || []
      const merged_items = [...new Set([...cached_items, ...local_items])]
      if (merged_items.length !== cached_items.length)
        return { ...cached, items: merged_items }
      return cached
    }

    let directory = /** @type {Directory | null} */ (
      await build_local_directory(itemid)
    )
    const may_fetch_network = online() && can_read(itemid)
    if (may_fetch_network)
      try {
        directory = await load_directory_from_network(itemid)
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          e.code === 'storage/unauthorized'
        )
          return directory
        throw e
      }

    return directory
  }

  /**
   * Resolve the storage base path of an item under an archive directory.
   * @param {string} itemid
   * @param {{ search_archives?: boolean }} [options]
   * @returns {Promise<string | null>}
   */
  const as_archive = async (itemid, { search_archives = false } = {}) => {
    if (itemid.startsWith('/+/')) return null
    const created = as_created_at(itemid)
    if (!created) return null
    const author = as_author(itemid)
    const type = as_type(itemid)

    const known_archive = await lookup_archive(itemid)
    if (known_archive) return paths.archive_path(itemid, known_archive)

    // Read the raw cached directory - `as_directory` merges locally cached item
    // keys into `items`, which makes an archived item with local html look like
    // it lives in the main directory and resolves to a 404ing storage path.
    const path = paths.directory_id(itemid)
    const directory = (await get(path)) ?? (await as_directory(itemid))
    if (!directory) return null

    const { items = [], archive = [] } = directory

    // Both shortcuts below read a directory that can be older than the archive
    // it describes. Storage 404ing the path they produced is proof of exactly
    // that, so a `search_archives` retry skips them and asks the archives.
    if (!search_archives) {
      const item_timestamps = items.map(Number)
      if (item_timestamps.includes(created)) return null
      if (item_timestamps.length > 0 && created > Math.max(...item_timestamps))
        return null
    }

    return archive.reduce(async (chain, archive_id) => {
      const found = await chain
      if (found) return found
      const dir_path = paths.directory_id(
        `/${author?.slice(1)}/${type}/${archive_id}/`
      )
      const dir = await as_directory(dir_path)
      if (dir?.items?.map(Number).includes(created)) {
        await remember_archive_locations(dir_path, archive_id, [created])
        return paths.archive_path(itemid, archive_id)
      }
      return null
    }, Promise.resolve(null))
  }

  return {
    Directory,
    is_directory_id,
    clear_author_dirs,
    build_local_directory,
    load_directory_from_network,
    lookup_archive,
    remember_archive_locations,
    as_directory,
    as_archive
  }
}
