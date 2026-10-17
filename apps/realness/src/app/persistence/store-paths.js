/** @fileoverview Realness's paths: itemid to storage paths, directory ids, and
 * every file an item owns. The store package asks these through its Paths seam. */
import { get } from 'idb-keyval'
import { has_archive, has_history } from '@realness.online/itemid'
import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  as_layer_id,
  as_poster_id,
  as_layer_name,
  use_filename_seam
} from '@/utils/itemid'

const LAYER_TYPES = [
  'shadows',
  'sediment',
  'sand',
  'gravel',
  'rocks',
  'boulders'
]

/** Layer itemids carry no leading slash once optimize builds them. */
const with_slash = itemid => (itemid.startsWith('/') ? itemid : `/${itemid}`)

/** idb key for `{ [created_at]: archive_id }`; see the store's `archive_map_id`. */
const archive_map_key = itemid =>
  `${as_author(itemid)}/${as_type(itemid)}/archive-map/`

const lookup_archive = async itemid => {
  const created = as_created_at(itemid)
  if (!created) return null
  const map = await get(archive_map_key(itemid))
  return map?.[created] ?? null
}

/**
 * The directory an itemid lives in, cached first, then from the network.
 * Injected by `persistence/Directory.js` so this module does not import the store.
 * @type {((itemid: string) => Promise<{ items?: unknown, archive?: unknown } | null>) | null}
 */
let directory_lookup = null

/**
 * @param {(itemid: string) => Promise<{ items?: unknown, archive?: unknown } | null>} lookup
 */
export const set_directory_lookup = lookup => {
  directory_lookup = lookup
}

/**
 * Remember which archive directory an item's `created_at` lives in.
 * @type {((itemid: string, archive_id: number, created_ats: number[]) => Promise<void>) | null}
 */
let remember_archive = null

/**
 * @param {(itemid: string, archive_id: number, created_ats: number[]) => Promise<void>} remember
 */
export const set_remember_archive_locations = remember => {
  remember_archive = remember
}

/**
 * Find the archive directory holding `created`, remembering it for next time.
 * @param {string} itemid
 * @param {boolean} search_archives
 * @returns {Promise<string | null>} the archive base path, or null
 */
const resolve_archive = async (itemid, search_archives) => {
  if (!directory_lookup) return null
  const created = as_created_at(itemid)
  if (!created) return null
  const author = as_author(itemid)
  const type = as_type(itemid)

  const directory = await directory_lookup(as_directory_id(itemid))
  if (!directory) return null

  const { items = [], archive = [] } =
    /** @type {{items?: unknown[], archive?: unknown[]}} */ (directory)

  if (!search_archives) {
    const item_timestamps = items.map(Number)
    if (item_timestamps.includes(created)) return null
    if (item_timestamps.length > 0 && created > Math.max(...item_timestamps))
      return null
  }

  for (const archive_id of archive) {
    const dir_path = `/${author?.slice(1)}/${type}/${archive_id}/`
    // eslint-disable-next-line no-await-in-loop
    const dir = await directory_lookup(dir_path)
    if (
      !(
        /** @type {{items?: unknown[]}} */ (dir)?.items
          ?.map(Number)
          .includes(created)
      )
    )
      continue
    // eslint-disable-next-line no-await-in-loop
    await remember_archive?.(dir_path, Number(archive_id), [created])
    return archive_path(itemid, Number(archive_id))
  }
  return null
}

/**
 * @param {import('@/types').Id} itemid
 * @returns {boolean}
 */
const is_history = itemid => {
  const parts = as_path_parts(itemid)
  const item_type = as_type(itemid)
  return (
    !!item_type &&
    has_history.includes(
      /** @type {typeof has_history[number]} */ (item_type)
    ) &&
    parts.length === 3
  )
}

/**
 * @param {string} itemid
 * @returns {string}
 */
export const as_directory_id = itemid => {
  const parts = as_path_parts(itemid)
  const [author, type, , archive] = parts
  if (archive && archive !== 'index') return `/${author}/${type}/${archive}/`
  return `/${author}/${type}/`
}

const directory_path = itemid => `people${as_directory_id(itemid)}`

const archive_path = (itemid, archive_id) =>
  `people${as_author(itemid)}/${as_type(itemid)}/${archive_id}/${as_created_at(itemid)}`

/**
 * A poster or layer filename at its pre-archive location.
 * @param {import('@/types').Id} itemid
 * @returns {string | null}
 */
export const as_top_level_filename = itemid => {
  const poster_id =
    as_poster_id(itemid) ?? (as_type(itemid) === 'posters' ? itemid : null)
  if (!poster_id) return null
  const poster_filename = poster_id.startsWith('/+')
    ? `people${poster_id}`
    : poster_id
  const layer_name = as_layer_name(itemid)
  const suffix = layer_name ? `-${layer_name}` : ''
  return `${poster_filename}${suffix}.html`
}

/**
 * @param {import('@/types').Id} itemid
 * @param {{ search_archives?: boolean }} [options] - passed through to
 *   `as_archive`; probes the archives rather than trusting the cached directory.
 * @returns {Promise<string>}
 */
export const as_filename = async (itemid, options) => {
  const poster_id = as_poster_id(itemid)
  if (poster_id) {
    const layer_name = as_layer_name(itemid)
    const suffix = layer_name ? `-${layer_name}` : ''
    const known = await lookup_archive(poster_id)
    if (known) return `${archive_path(poster_id, known)}${suffix}.html`
    const searched = await resolve_archive(
      poster_id,
      !!options?.search_archives
    )
    if (searched) return `${searched}${suffix}.html`
    const top_level = as_top_level_filename(itemid)
    if (top_level) return top_level
  }

  let filename = itemid
  if (itemid.startsWith('/+')) filename = `people${itemid}`

  const item_type = as_type(itemid)
  if (
    item_type &&
    has_archive.includes(/** @type {typeof has_archive[number]} */ (item_type))
  ) {
    const known = await lookup_archive(itemid)
    if (known) return `${archive_path(itemid, known)}.html`
    const searched = await resolve_archive(itemid, !!options?.search_archives)
    if (searched) return `${searched}.html`
    return `${filename}.html`
  } else if (is_history(itemid)) return `${filename}.html`
  else if (item_type === 'relations') {
    const base = filename.replace(/\/relations$/, '')
    return `${base}/relations.html`
  }

  return `${filename}/index.html`
}

const files = async (itemid, archive_id = null) => {
  const path = with_slash(itemid)
  if (as_type(path) !== 'posters') return [await as_filename(path)]
  const base = archive_id
    ? archive_path(path, archive_id)
    : (await as_filename(path)).replace(/\.html$/, '')
  return [`${base}.html`, ...LAYER_TYPES.map(layer => `${base}-${layer}.html`)]
}

export const paths = {
  storage_path: itemid => as_filename(with_slash(itemid)),
  directory_id: as_directory_id,
  directory_path,
  archive_path,
  created_at_from_filename: (name, scope_itemid) => {
    const [filename] = name.split('.')
    if (as_type(scope_itemid) === 'posters' && filename.includes('-'))
      return null
    const created = parseInt(filename)
    return Number.isNaN(created) ? null : created
  },
  files,
  siblings: itemid => {
    const path = with_slash(itemid)
    if (as_type(path) !== 'posters') return []
    return LAYER_TYPES.map(layer => as_layer_id(path, layer))
  }
}

use_filename_seam({ as_filename, as_top_level_filename })
