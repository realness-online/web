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
import { grantee_org } from '#root/src/can/can.js'
import { plan_summary } from './vault-plans.js'
import { read_frontmatter } from './frontmatter.js'

export const members_key = name => `orgs/${name}/members.html`

const GZIP_MAGIC = Buffer.from('1f8b', 'hex')
export const text_of = body =>
  (body.subarray(0, 2).equals(GZIP_MAGIC) ? gunzip_sync(body) : body).toString(
    'utf8'
  )

/**
 * `{ founder, members }`, `null` if the org has no page, or nobody if bad.
 * @returns {Promise<{ founder: string | null, members: string[] } | null>}
 */
export const read_org = async (storage, name) => {
  const page = await storage.get(members_key(name))
  if (!page) return null
  try {
    return read_members(text_of(page.body))
  } catch {
    return { founder: null, members: [] }
  }
}

/**
 * sh8: an org's name and its people, as the account page lists them. A page
 * that will not read gives the name alone.
 * @returns {Promise<{ name: string, title?: string, short?: string, url?: string, logo?: string, founder?: string | null, people?: { name: string, phone: string, role: string }[] }>}
 */
const org_with_people = async (storage, name) => {
  const page = await storage.get(members_key(name))
  if (!page) return { name }
  try {
    const { founder, people, title, short, url, logo } = read_members(
      text_of(page.body)
    )
    return { name, title, short, url, logo, founder, people }
  } catch {
    return { name, founder: null, people: [] }
  }
}

/** sh8: the account page's org list, each with its people. */
export const orgs_with_people = async (storage, phone) =>
  Promise.all(
    (await orgs_of(storage, phone)).map(name => org_with_people(storage, name))
  )

/** The orgs a person is in, by scanning every members page. */
export const orgs_of = async (storage, phone) => {
  const { folders } = await storage.list('orgs/')
  const names = folders.map(name => name.replace(/\/$/, ''))
  const orgs = await Promise.all(names.map(name => read_org(storage, name)))
  return names.filter((_, i) => orgs[i]?.members.includes(phone))
}

/**
 * o2: the orgs named by grants that hold this person. Reading them fresh on
 * every request is what ends a removed member's reads.
 * @param {object} storage
 * @param {import('#root/src/can/can.js').Grant[]} grants triples from the owner's rights page
 * @param {string | undefined} phone
 * @returns {Promise<string[]>} org names, as in `+family`
 */
export const granted_orgs = async (storage, grants, phone) => {
  if (!phone) return []
  /** @type {Set<string>} */
  const names = new Set()
  for (const { grantee } of Array.isArray(grants) ? grants : []) {
    const name = grantee_org(grantee)
    if (name?.startsWith('+')) names.add(name)
  }
  const found = [...names]
  const orgs = await Promise.all(found.map(name => read_org(storage, name)))
  return found.filter((_, at) => orgs[at]?.members.includes(phone))
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

const ORG_PLAN = /^(?:[^/]+\.md|[^/]+\/index\.md)$/

/**
 * x4: the plans in every org a person is in, from `orgs/+name/Projects/`.
 * A plan's area is its org's short name, and a narrower `members.html` that
 * leaves the person out hides the plan.
 * @returns {Promise<import('./vault-plans.js').PlanSummary[]>}
 */
export const org_plans = async (storage, phone) => {
  const orgs = await orgs_with_people(storage, phone)
  const found = await Promise.all(
    orgs.map(async org => {
      const folder = `orgs/${org.name}/Projects/`
      const names = Object.keys(await storage.walk(folder)).filter(name =>
        ORG_PLAN.test(name)
      )
      const plans = await Promise.all(
        names.map(async name => {
          const key = `${folder}${name}`
          const along = await read_org_along(storage, key)
          if (!along?.members.includes(phone)) return null
          const page = await storage.get(key)
          if (!page) return null
          const plan = plan_summary(`Projects/${name}`, text_of(page.body))
          return (
            plan && {
              ...plan,
              path: key,
              area: org.short ?? org.title ?? org.name
            }
          )
        })
      )
      return plans.filter(plan => plan !== null)
    })
  )
  return found.flat()
}

/**
 * x4, x5: one org note by itemid - a plan, a dashboard - for a member of its
 * org, as a note to show.
 * @returns {Promise<{ path: string, title: string, text: string, itemid: string, layout: string, created: string } | null>}
 */
export const org_note = async (storage, phone, itemid) => {
  const folders = await Promise.all(
    (await orgs_of(storage, phone)).map(async name => {
      const folder = `orgs/${name}/`
      return Object.keys(await storage.walk(folder))
        .filter(path => path.endsWith('.md'))
        .map(note => ({ note, key: `${folder}${note}` }))
    })
  )
  const notes = await Promise.all(
    folders.flat().map(async ({ note, key }) => {
      const page = await storage.get(key)
      return { note, key, ...read_frontmatter(page ? text_of(page.body) : '') }
    })
  )
  const found = notes.find(({ data }) => String(data.itemid ?? '') === itemid)
  if (!found) return null
  const { note, key, data, body } = found
  const along = await read_org_along(storage, key)
  if (!along?.members.includes(phone)) return null
  return {
    path: key,
    title: String(data.title ?? /^# (.+)$/m.exec(body)?.[1] ?? note),
    text: body,
    itemid,
    layout: data.layout ? String(data.layout) : '',
    created: data.created ? String(data.created) : ''
  }
}
