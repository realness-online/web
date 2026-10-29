/**
 * gz1: every file is stored as `name.gz` while callers keep the plain name.
 * `x` is read and written at `x.gz`; listings, walks, and finds show `x` and
 * hide anything not ending `.gz`. Versions are the plain bytes' hash, as the
 * adapters already give them. The store's own `.meta/` and `.index/` sit
 * outside any key.
 */
const SUFFIX = '.gz'
const stored = key => `${key}${SUFFIX}`
const shown = key => key.slice(0, -SUFFIX.length)
const zipped = name => name.endsWith(SUFFIX)

/** Map an object of `name.gz: value` to `name: value`, dropping other names. */
const plain_entries = entries =>
  Object.fromEntries(
    Object.entries(entries)
      .filter(([name]) => zipped(name))
      .map(([name, value]) => [shown(name), value])
  )

/**
 * @template {{ get: Function, put: Function, delete: Function, list: Function, walk: Function, walk_meta: Function, stat: Function, compose: Function, find: Function }} S
 * @param {S} storage
 * @returns {S}
 */
export const gz_keys = storage => ({
  ...storage,
  get: (key, options) => storage.get(stored(key), options),
  put: (key, body, options) => storage.put(stored(key), body, options),
  delete: (key, options) => storage.delete(stored(key), options),
  stat: key => storage.stat(stored(key)),
  compose: (key, sources, options) =>
    storage.compose(stored(key), sources.map(stored), options),
  async list(prefix) {
    const listing = await storage.list(prefix)
    return { ...listing, files: listing.files.filter(zipped).map(shown) }
  },
  walk: async prefix => plain_entries(await storage.walk(prefix)),
  walk_meta: async prefix => plain_entries(await storage.walk_meta(prefix)),
  find: async (scope, version) =>
    (await storage.find(scope, version)).filter(zipped).map(shown)
})
