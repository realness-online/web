/**
 * st1, st2: where keys live in a store, apart from what they are called.
 * Callers, URLs, and rights keep their keys; the store groups them:
 *
 *   admins.html, halos/, halo-keys/, placements/,   ->  server/<key>
 *   pins/, pins-realness/, loops/, git/
 *   usage/+A/..., billing/+A/..., subscriptions/+A/...  ->  people/+A/<folder>/...
 *
 * So a store's top holds people, their shared folders, and `server/`. The
 * per-person folders are reached only by their own keys: a `people/+A/usage/`
 * key is refused, and walks and listings of a person leave them out.
 */
const SERVER = new Set([
  'admins.html',
  'halos',
  'halo-keys',
  'placements',
  'pins',
  'pins-realness',
  'loops',
  'git'
])
const PERSONAL = new Set(['usage', 'billing', 'subscriptions'])
const PERSON = /^\+[1-9]\d{6,14}$/

/** A key that only a per-person key may reach. */
export class Reserved extends Error {
  code = 'reserved'
}

/** Where a key lives in the store. */
export const placed = key => {
  const [first, second, ...rest] = key.split('/')
  if (SERVER.has(first)) return `server/${key}`
  if (PERSONAL.has(first) && second !== undefined && PERSON.test(second))
    return ['people', second, first, ...rest].join('/')
  if (first === 'server') throw new Reserved(key)
  if (first === 'people' && PERSONAL.has(rest[0] ?? '')) throw new Reserved(key)
  return key
}

/** The key a stored path answers to. */
export const named = stored => {
  const [first, second, third, ...rest] = stored.split('/')
  if (first === 'server') return stored.slice('server/'.length)
  if (first === 'people' && PERSONAL.has(third ?? ''))
    return [third, second, ...rest].join('/')
  return stored
}

/** A person's folder, `people/+A/`, whose listings hide the personal folders. */
const is_person = prefix => /^people\/\+[^/]+\/?$/.test(prefix)
const visible = name => !PERSONAL.has(name.split('/')[0])
const keep = (entries, prefix) =>
  is_person(prefix)
    ? Object.fromEntries(
        Object.entries(entries).filter(([name]) => visible(name))
      )
    : entries

/** A top-level personal folder, `usage/`, listed across people. */
const personal_root = prefix => {
  const name = prefix.replace(/\/$/, '')
  return PERSONAL.has(name) ? name : null
}

/**
 * @template {{ get: Function, put: Function, delete: Function, list: Function, walk: Function, walk_meta: Function, stat: Function, compose: Function, find: Function }} S
 * @param {S} storage
 * @returns {S}
 */
export const layout = storage => ({
  ...storage,
  get: (key, options) => storage.get(placed(key), options),
  put: (key, body, options) => storage.put(placed(key), body, options),
  delete: (key, options) => storage.delete(placed(key), options),
  stat: key => storage.stat(placed(key)),
  compose: (key, sources, options) =>
    storage.compose(placed(key), sources.map(placed), options),
  async list(prefix) {
    const folder = personal_root(prefix)
    if (folder) {
      const { folders } = await storage.list('people/')
      const holding = []
      for (const person of folders)
        // eslint-disable-next-line no-await-in-loop -- people are few; one listing each
        if ((await storage.list(`people/${person}/`)).folders.includes(folder))
          holding.push(person)
      return { files: [], folders: holding }
    }
    const listing = await storage.list(placed(prefix))
    if (!is_person(prefix)) return listing
    return { ...listing, folders: listing.folders.filter(visible) }
  },
  walk: async prefix => keep(await storage.walk(placed(prefix)), prefix),
  walk_meta: async prefix =>
    keep(await storage.walk_meta(placed(prefix)), prefix),
  find: async (scope, version) =>
    (await storage.find(placed(scope), version))
      .map(named)
      .filter(key => key.startsWith(scope))
})
