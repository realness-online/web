/**
 * What is a person's own, at `people/<phone>/`, the same path as on the Mac.
 * Every harness starts from the same baseline, so `.pi/`, `apps/`, and the
 * rest never upload.
 */
const OWN = new Set(['vault', 'work', 'AGENTS.md', '.ignore'])

/** Harness state that syncs beside a person's own files. */
const STATE = [
  '.pi/agent/sessions',
  '.pi/agent/deferred.json',
  '.pi/starter.json'
]

/** Sealed months of agent memory, synced on their own, and where they sit locally. */
export const MEMORY_FOLDER = 'vault/.memory'
export const MEMORY_LOCAL = '.pi/agent/memory'

const under = (path, folder) => path === folder || path.startsWith(`${folder}/`)

/** @param {string} path */
export const is_own = path => OWN.has(path.split('/')[0])

/**
 * What a whole-harness pass may write.
 * @param {string} path
 */
export const is_synced = path =>
  is_own(path) || STATE.some(folder => under(path, folder))

/**
 * A folder that holds something a whole-harness pass may write.
 * @param {string} folder
 */
export const holds_synced = folder =>
  is_synced(folder) || STATE.some(path => under(path, folder))

/** @param {string} path */
export const in_memory = path => under(path, MEMORY_FOLDER)
