/** @fileoverview Realness's paths: itemid to storage paths, directory ids, and
 * every file an item owns. The store package asks these through its Paths seam. */
import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  as_layer_id,
  as_filename
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

const files = async (itemid, archive_id = null) => {
  const path = with_slash(itemid)
  if (as_type(path) !== 'posters') return [await as_filename(path)]
  const base = archive_id
    ? archive_path(path, archive_id)
    : (await as_filename(path)).replace(/\.html\.gz$/, '')
  return [
    `${base}.html.gz`,
    ...LAYER_TYPES.map(layer => `${base}-${layer}.html.gz`)
  ]
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
