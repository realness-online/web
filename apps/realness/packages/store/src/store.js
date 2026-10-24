import { create_itemid } from '@realness.online/itemid'
import { create_storage } from './storage.js'
import { Local } from './local.js'
import { create_large } from './large.js'
import { create_cloud } from './cloud.js'
import { create_directory } from './directory.js'

/**
 * The app side of the store, three seams.
 *
 * @typedef {Object} Backend
 * @property {(path: string, body: string | Blob, metadata: object) => Promise<object>} upload
 * @property {(path: string) => Promise<void>} remove
 * @property {(from: string, to: string) => Promise<boolean>} move
 * @property {(path: string) => Promise<string>} url
 * @property {(path: string) => Promise<{items?: {name: string}[], prefixes?: {name: string}[]}>} directory
 * @property {() => boolean} online
 * @property {() => boolean} signed_in
 * @property {(items: object | string) => Promise<{compressed: string | Blob, metadata: object}>} [serialize] - default: raw html, text/html
 * @property {(itemid: string) => boolean} [can_read] - default: signed_in()
 * @property {(itemid: string, path: string, response: object) => Promise<void>} [after_upload]
 * @property {(itemids: string[]) => Promise<void>} [after_directory]
 * @property {(itemid: string, action: 'save' | 'delete') => Promise<void>} [later] - where offline writes go
 *
 * @typedef {Object} Paths
 * @property {(itemid: string) => Promise<string>} storage_path - itemid to its file
 * @property {(itemid: string) => string} directory_id - itemid to its directory id (the cache key)
 * @property {(itemid: string) => string} directory_path - itemid to the directory's storage path
 * @property {(itemid: string, archive_id: number) => string} archive_path - itemid plus its archive to a storage base path
 * @property {(name: string, scope_itemid: string) => number | null} created_at_from_filename - a listed file name, or null
 * @property {(itemid: string, archive_id?: number | null) => Promise<string[]>} files - every file an item owns, live or archived
 * @property {(itemid: string) => string[]} siblings - other local itemids that belong to this one
 *
 * @typedef {Object} Vocabulary
 * @property {readonly string[]} types
 * @property {readonly string[]} [requires_timestamp]
 * @property {readonly string[]} networkable
 * @property {readonly string[]} archived
 * @property {readonly string[]} paged
 * @property {{MIN: number, MID: number, MAX: number}} sizes
 */

/**
 * Build a store for one vocabulary. The returned mixins and Directory functions
 * are already bound to the seams, so no call site passes them again.
 * @param {{ backend?: Backend, paths?: Paths, vocabulary?: Vocabulary }} [config]
 */
export const create_store = ({ backend, paths, vocabulary } = {}) => {
  if (!vocabulary?.types?.length)
    throw new Error('create_store needs a non-empty vocabulary.types')
  if (!backend) throw new Error('create_store needs a backend')
  if (!paths) throw new Error('create_store needs paths')

  const itemid = create_itemid({
    types: vocabulary.types,
    requires_timestamp: vocabulary.requires_timestamp ?? []
  })
  const directory = create_directory({ backend, paths, itemid })
  const Storage = create_storage({ as_type: itemid.as_type })
  const Large = create_large({ paths, itemid })
  const Cloud = create_cloud({
    backend,
    paths,
    vocabulary,
    itemid,
    as_directory: directory.as_directory,
    load_directory_from_network: directory.load_directory_from_network
  })

  return {
    Storage,
    Local,
    Large,
    Cloud,
    itemid,
    backend,
    paths,
    vocabulary,
    ...directory
  }
}
