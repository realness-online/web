// This app's store: `@realness/store` wired to the dev backend, this app's
// paths, and its vocabulary.
import { create_store } from '@realness/store'
import { backend } from './backend.js'
import { paths } from './paths.js'
import { vocabulary } from './vocabulary.js'

export const store = create_store({ backend, paths, vocabulary })

export const { Storage, Local, Cloud, Directory, as_directory } = store

/** One note. The id is its itemid; the element it saves is its record. */
export class Note extends Cloud(Storage) {}