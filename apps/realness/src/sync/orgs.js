/**
 * Orgs as files. An org's name is its folder, `orgs/+family/`, and never
 * changes once made; `members.html` there says who is in it.
 *
 * There are only a few orgs, so nothing is cached: every request reads the
 * page fresh, and a removed member is refused on their next request.
 * A malformed members page lets nobody in; the founder fixes it on disk.
 * Subfolders may hold their own `members.html` to narrow who reaches them.
 */
import { gunzipSync as gunzip_sync } from 'node:zlib'
import { read_members } from '#root/src/can/members.js'

export const members_key = name => `orgs/${name}/members.html`

const GZIP_MAGIC = Buffer.from('1f8b', 'hex')
export const text_of = body =>
  (body.subarray(0, 2).equals(GZIP_MAGIC) ? gunzip_sync(body) : body).toString(
    'utf8'
  )

/** `{ founder, members }`, `null` if the org has no page, or nobody if bad. */
export const read_org = async (storage, name) => {
  const page = await storage.get(members_key(name))
  if (!page) return null
  try {
    return read_members(text_of(page.body))
  } catch {
    return { founder: null, members: [] }
  }
}

/** The orgs a person is in, by scanning every members page. */
export const orgs_of = async (storage, phone) => {
  const { folders } = await storage.list('orgs/')
  const names = folders.map(name => name.replace(/\/$/, ''))
  const orgs = await Promise.all(names.map(name => read_org(storage, name)))
  return names.filter((_, i) => orgs[i]?.members.includes(phone))
}

/**
 * sh2, sh3: every `members.html` from the org down to the path must list
 * you. A folder without one inherits; a deeper list only narrows, since
 * members are the people on every list. The top page names the founder.
 * Returns null when the org has no top page.
 */
export const read_org_along = async (storage, path) => {
  const [, name, ...rest] = path.split('/')
  const top = await read_org(storage, name)
  if (!top) return null
  const folders = rest.slice(0, -1).filter(Boolean)
  const pages = await Promise.all(
    folders.map(async (_, i) => {
      const key = `orgs/${name}/${folders.slice(0, i + 1).join('/')}/members.html`
      const page = await storage.get(key)
      if (!page) return null
      try {
        return read_members(text_of(page.body)).members
      } catch {
        return []
      }
    })
  )
  const members = pages
    .filter(Boolean)
    .reduce(
      (kept, list) => kept.filter(phone => list.includes(phone)),
      top.members
    )
  return { founder: top.founder, members }
}
