/** @fileoverview Realness's store: `@realness.online/store` wired to Firebase, this
 * app's paths, and its vocabulary. The files beside this one re-export these
 * bindings so existing imports do not move. */
import { create_store } from '@realness.online/store'
import { backend } from './store-backend.js'
import { paths } from './store-paths.js'
import { vocabulary } from './store-vocabulary.js'

export const store = create_store({ backend, paths, vocabulary })

export const { Storage, Local, Large, Cloud } = store
export const {
  is_directory_id,
  clear_author_dirs,
  build_local_directory,
  load_directory_from_network,
  lookup_archive,
  remember_archive_locations,
  as_directory,
  as_archive
} = store
export { as_directory_id } from './store-paths.js'
export { sync_later } from './store-backend.js'
