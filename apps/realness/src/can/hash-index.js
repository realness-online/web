/**
 * Which paths hold a version, per person: `people/+A/` is one scope. The
 * index splits by the version's first two characters, so a lookup reads one
 * small piece and a write rewrites one. Keys outside `people/` are not
 * indexed.
 *
 * Adapters give it two primitives over a piece:
 *   read(piece)                 { entries, generation } ; entries { version: [key] }
 *   write(piece, entries, generation)  throws Conflict when the piece moved
 * and may give `exclusive(piece, work)` to run each change alone. Equal
 * files share a piece, so a burst of them races on it; a race that never
 * settles is an error, never a Conflict, so it cannot pass for a stale write.
 */
import { Conflict } from './contract.js'

const PIECE_CHARS = 2
const RETRIES = 12
const BACKOFF_MS = 20
const MAX_DOUBLINGS = 6
const HEX = 16

const pause = attempt =>
  new Promise(done => {
    setTimeout(
      done,
      Math.random() * BACKOFF_MS * 2 ** Math.min(attempt, MAX_DOUBLINGS)
    )
  })

/** `people/+A/` for a person's key, else null. */
export const index_scope = key => {
  const [top, owner, ...rest] = key.split('/')
  return top === 'people' && owner && rest.length ? `people/${owner}/` : null
}

/**
 * The piece a version lives in, under its scope. The two characters are
 * named by their hex codes: a Mac's disk ignores case, and `Ab` and `aB`
 * must stay apart.
 */
export const piece_of = (scope, version) =>
  `${scope}${Array.from(version.slice(0, PIECE_CHARS), char =>
    char.charCodeAt(0).toString(HEX)
  ).join('')}.json`

/**
 * @param {{
 *   read: (piece: string) => Promise<{ entries: Record<string, string[]>, generation: unknown }>,
 *   write: (piece: string, entries: Record<string, string[]>, generation: unknown) => Promise<void>,
 *   exclusive?: <T>(piece: string, work: () => Promise<T>) => Promise<T>
 * }} pieces
 */
export const hash_index = ({
  read,
  write,
  exclusive = (piece, work) => work()
}) => {
  /** Read, change, write; a piece that moved underneath is read again. */
  const change = (piece, edit) =>
    exclusive(piece, async () => {
      /* eslint-disable no-await-in-loop -- each retry follows a lost race */
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        const { entries, generation } = await read(piece)
        if (!edit(entries)) return
        try {
          return await write(piece, entries, generation)
        } catch (error) {
          if (!(error instanceof Conflict)) throw error
        }
        await pause(attempt)
      }
      /* eslint-enable no-await-in-loop */
      throw new Error(`index ${piece} kept moving`)
    })

  const add = (key, version) => {
    const scope = index_scope(key)
    if (!scope || !version) return
    return change(piece_of(scope, version), entries => {
      const keys = entries[version] ?? []
      if (keys.includes(key)) return false
      entries[version] = [...keys, key].sort()
      return true
    })
  }

  const remove = (key, version) => {
    const scope = index_scope(key)
    if (!scope || !version) return
    return change(piece_of(scope, version), entries => {
      const keys = entries[version]
      if (!keys?.includes(key)) return false
      const left = keys.filter(k => k !== key)
      if (left.length) entries[version] = left
      else delete entries[version]
      return true
    })
  }

  return {
    /** A key moved from one version to another; either may be null. */
    async moved(key, from, to) {
      if (from === to) return
      await remove(key, from)
      await add(key, to)
    },

    /** Every key in `scope` holding `version`, sorted. */
    async find(scope, version) {
      if (!index_scope(`${scope}x`) || !version) return []
      const { entries } = await read(piece_of(scope, version))
      return entries[version] ?? []
    }
  }
}
