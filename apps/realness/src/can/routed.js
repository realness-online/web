/**
 * l2: one folder of keys lives in another store. On the Mac, a person's
 * `people/+A/quarantine/` is `quarantine/` beside `vault/`, plain on disk, the
 * same path as in the cloud, and never in iCloud. Every other key stays where
 * it was.
 */

/**
 * @template {{ get: Function, put: Function, delete: Function, list: Function, walk: Function, walk_meta: Function, stat: Function, compose: Function, find: Function }} S
 * @param {S} storage
 * @param {string} prefix the folder that moves, ending `/`
 * @param {S} other the store that holds it
 * @returns {S}
 */
export const routed = (storage, prefix, other) => {
  const name = prefix.slice(0, -1).split('/').at(-1) ?? ''
  const parent = prefix.slice(0, -name.length - 1)
  const inside = key => key.startsWith(prefix)
  const strip = key => key.slice(prefix.length)
  const to = key => (inside(key) ? [other, strip(key)] : [storage, key])
  const below = (entries, at) =>
    Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [
        prefix.slice(at.length) + key,
        value
      ])
    )

  /** A walk that reaches the folder from above holds both stores' files. */
  const walking = method => async at => {
    if (inside(at)) return other[method](strip(at))
    const found = await storage[method](at)
    if (!prefix.startsWith(at)) return found
    return { ...found, ...below(await other[method](''), at) }
  }

  return {
    ...storage,
    get: (key, options) => {
      const [store, at] = to(key)
      return store.get(at, options)
    },
    put: (key, body, options) => {
      const [store, at] = to(key)
      return store.put(at, body, options)
    },
    delete: (key, options) => {
      const [store, at] = to(key)
      return store.delete(at, options)
    },
    stat: key => {
      const [store, at] = to(key)
      return store.stat(at)
    },
    compose: (key, sources, options) => {
      if (!sources.every(source => inside(source) === inside(key)))
        throw new Error(`routed: ${key} and its sources sit in two stores`)
      const [store, at] = to(key)
      return store.compose(
        at,
        inside(key) ? sources.map(strip) : sources,
        options
      )
    },
    async list(at) {
      if (inside(at)) return other.list(strip(at))
      const listing = await storage.list(at)
      if (at !== parent || listing.folders.includes(name)) return listing
      return { ...listing, folders: [...listing.folders, name] }
    },
    walk: walking('walk'),
    walk_meta: walking('walk_meta'),
    find: async (scope, version) => {
      if (inside(scope))
        return (await other.find(strip(scope), version)).map(
          key => prefix + key
        )
      const found = await storage.find(scope, version)
      if (!prefix.startsWith(scope)) return found
      return [
        ...found,
        ...(await other.find('', version)).map(key => prefix + key)
      ]
    }
  }
}
