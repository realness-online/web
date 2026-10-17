/** @fileoverview Realness's store: `@realness.online/store` wired to Firebase, this
 * app's paths, and its vocabulary. The files beside this one re-export these
 * bindings so existing imports do not move. */
import { create_store } from '@realness.online/store'
import { backend } from './store-backend.js'
import {
  paths,
  set_directory_lookup,
  set_remember_archive_locations
} from './store-paths.js'
import { vocabulary } from './store-vocabulary.js'

const store = create_store({ backend, paths, vocabulary })

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

set_directory_lookup(as_directory)
set_remember_archive_locations(remember_archive_locations)

export { as_directory_id } from './store-paths.js'
