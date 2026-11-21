/**
 * Two labels say whether a copy of the code is current. The halo label covers
 * the halo's own code; the actor label covers the harness scripts an actor
 * runs. The Mac computes both; the halo reports its own, the image stores the
 * actor label at `CODE_STAMP_FILE`, and each actor records it at start.
 */
import { createHash as create_hash } from 'node:crypto'
import {
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  statSync as stat_sync
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { halo_files, halo_folders } from '#root/src/settings/layout.js'

/** Where a built image records the actor label it holds. */
const CODE_STAMP_FILE = '/etc/realness-code'

/** Where a staged halo records the actor label it was shipped with. */
export const SHIPPED_ACTOR_FILE = '.actor-code'

const APP = resolve(import.meta.dirname, '..')
const HARNESS = resolve(APP, '../..')
const GUEST = 'server/halo/guest'
const SCRIPTS = '.pi/bin'

const sha256 = bytes => create_hash('sha256').update(bytes).digest('hex')

/** Regular files under `path`, as `/`-paths relative to `root`. */
const files_under = (root, path) => {
  const at = join(root, path)
  try {
    if (stat_sync(at).isFile()) return [path]
  } catch {
    return []
  }
  return readdir_sync(at, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')
    )
}

/** @param {string} root @param {string[]} files */
const hash_files = (root, files) =>
  sha256(
    [...new Set(files)]
      .sort()
      .map(file => `${file}\0${sha256(read_file_sync(join(root, file)))}\n`)
      .join('')
  )

/**
 * The halo's own code, relative to the app root: what a halo serves and the
 * guest scripts it lays into each actor.
 * @param {string} [app] the `apps/realness` folder
 */
export const halo_code_files = (app = APP) => [
  ...halo_files.flatMap(file => files_under(app, file)),
  ...halo_folders().flatMap(folder => files_under(app, folder)),
  ...files_under(app, GUEST)
]

/** @param {string} [app] the `apps/realness` folder */
export const halo_code = (app = APP) => hash_files(app, halo_code_files(app))

/**
 * The harness scripts an actor runs, relative to the harness root.
 * @param {string} [root] the harness root
 */
export const actor_code_files = (root = HARNESS) => files_under(root, SCRIPTS)

/** @param {string} [root] the harness root */
export const actor_code = (root = HARNESS) =>
  hash_files(root, actor_code_files(root))

/**
 * A label a file recorded; null when it recorded none.
 * @param {string} [file]
 */
export const read_code_stamp = (file = CODE_STAMP_FILE) => {
  try {
    return read_file_sync(file, 'utf8').trim() || null
  } catch {
    return null
  }
}

/**
 * The actor label a halo expects its image to hold: the one the Mac wrote
 * beside the halo's code when it shipped or started it.
 * @param {string} [app] the `apps/realness` folder
 */
export const shipped_actor_code = (app = APP) =>
  read_code_stamp(join(app, SHIPPED_ACTOR_FILE))

/**
 * Whether two copies are the same code. A missing label is never a match.
 * @param {string | null} one
 * @param {string | null} other
 */
export const same_code = (one, other) =>
  Boolean(one) && Boolean(other) && one === other

/**
 * Which of an actor's labels no longer match what the halo would give it now:
 * `halo` for the guest scripts it copied, `image` for the image it started
 * from. An empty list means the actor runs current code.
 * @param {{ halo?: string | null, image?: string | null } | null | undefined} started
 * @param {{ halo: string | null, image: string | null }} now
 * @returns {('halo' | 'image')[]}
 */
export const stale_code = (started, now) =>
  /** @type {('halo' | 'image')[]} */ (['halo', 'image']).filter(
    part => !same_code(started?.[part] ?? null, now[part])
  )
