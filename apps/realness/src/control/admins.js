/**
 * n1: manage an environment's global admins, the people of the network org
 * `orgs/+realness/members.html` (src/sync/admins.js). The first admin is
 * its founder. With the bucket owner's credentials this writes the page
 * before any admin can sign in; after that the founder may also edit it on
 * the account page.
 *
 * While the network org has no page, the older `admins.html` is read as the
 * list, and the first write moves it into the network org.
 *
 * Writes are conditional on the version that was read, so two operators
 * cannot silently overwrite each other. Removing the last admin is refused.
 */
import {
  LEGACY_KEY,
  NETWORK,
  NETWORK_KEY,
  admins_page,
  read_admins
} from '#root/src/sync/admins.js'
import { members_html, read_people } from '#root/src/can/members.js'
import { unescape } from '#root/lib/items.js'

const PHONE = /^\+[1-9]\d{6,14}$/
const ENTRY =
  /<a\b[^>]*href="tel:(\+[1-9]\d{6,14})"[^>]*>([\s\S]*?)<\/a>([^<]*)/g
const TAGS = /<[^>]*>/g

/** Admins still in tel: links, the shape pages were written in before microdata. */
const legacy_admins = html => {
  const found = new Map()
  for (const [, phone, label, after] of html.matchAll(ENTRY)) {
    if (found.has(phone)) continue
    const shown = unescape(label.replace(TAGS, '')).trim()
    found.set(phone, unescape(after).trim() || shown)
  }
  return [...found].map(([phone, name]) => ({ phone, name }))
}

/**
 * Every admin and its name, in page order: the founder and the members alike.
 * Reads the microdata page, and an older tel: page when there are no people.
 */
export const parse_admins = html => {
  const people = read_people(html)
  const admins = people.map(({ phone, name }) => ({ phone, name }))
  return admins.length ? admins : legacy_admins(html)
}

/**
 * The network org's page; `read_admins` must see exactly these phones. The
 * first admin is the founder, the rest are members.
 */
export const render_admins = list => {
  const [founder, ...members] = list
  if (!founder) throw new Error('an admins page needs one admin')
  return members_html({ name: NETWORK, title: 'Realness', founder, members })
}

/** Where a write goes: over the network page it read, or a new one. */
const guard_of = page =>
  page?.key === NETWORK_KEY ? { if_version: page.version } : { if_absent: true }

/** Writes the network page; an older admins page it replaced is removed. */
const write_network = async (storage, page, html) => {
  await storage.put(NETWORK_KEY, html, guard_of(page))
  if (page?.key === LEGACY_KEY)
    await storage.delete(LEGACY_KEY, { if_version: page.version })
}

const check_phone = phone => {
  if (typeof phone !== 'string' || !PHONE.test(phone))
    throw new Error(
      `admin phone must look like +14155551234, not ${JSON.stringify(phone)}`
    )
  return phone
}

/** What a change would leave, without writing; throws when the change is unsafe. */
export const plan_admins = (list, { verb, phone, name = '' }) => {
  if (verb === 'list') return { list, changed: false }
  check_phone(phone)
  const present = list.some(admin => admin.phone === phone)
  if (verb === 'add') {
    if (present)
      return { list, changed: false, note: `${phone} is already an admin` }
    return { list: [...list, { phone, name: name.trim() }], changed: true }
  }
  if (verb === 'remove') {
    if (!present)
      return { list, changed: false, note: `${phone} is not an admin` }
    if (list.length === 1)
      throw new Error('refusing to remove the last admin; add another first')
    return { list: list.filter(admin => admin.phone !== phone), changed: true }
  }
  throw new Error(
    'usage: realness <env> admins list | add <phone> [name] | remove <phone> [--yes]'
  )
}

/**
 * Read, plan, and (with `yes`) write. Without `yes` nothing is written and
 * the result says what would change.
 * @param {{ get: (key: string) => Promise<{ body: Buffer, version: string } | null>, put: (key: string, body: string, options?: { if_version?: string, if_absent?: boolean }) => Promise<unknown> }} storage
 * @param {object} [options]
 * @param {'list' | 'init' | 'add' | 'remove'} [options.verb]
 * @param {string} [options.phone]
 * @param {string} [options.name]
 * @param {boolean} [options.yes]
 * @param {boolean} [options.create_only]
 * @returns {Promise<{ before: object[], after: object[], changed: boolean, written: boolean, note?: string }>}
 */
export const manage_admins = async (
  storage,
  { verb = 'list', phone, name, yes = false } = {}
) => {
  const page = await admins_page(storage)
  const before = parse_admins(page?.html ?? '')
  const { list, changed, note } = plan_admins(before, { verb, phone, name })
  const result = {
    before,
    after: list,
    changed,
    written: false,
    ...(note ? { note } : {})
  }
  if (!changed || !yes) return result
  const html = render_admins(list)
  const written = read_admins(html)
  if (
    written.size !== list.length ||
    !list.every(admin => written.has(admin.phone))
  )
    throw new Error('rendered admins page does not round-trip')
  await write_network(storage, page, html)
  return { ...result, written: true }
}

/**
 * Make sure `people` are admins, keeping everyone already listed. With
 * `create_only`, an existing page is left exactly as it is: a new environment
 * gets its first admin, and a running one is never edited behind its admins.
 */
export const ensure_admins = async (
  storage,
  people,
  { create_only = false } = {}
) => {
  const wanted = people
    .filter(Boolean)
    .map(({ phone, name = '' }) => ({ phone: check_phone(phone), name }))
  const page = await admins_page(storage)
  const before = parse_admins(page?.html ?? '')
  const moved = page?.key === NETWORK_KEY
  if (moved && create_only)
    return {
      before,
      after: before,
      changed: false,
      written: false,
      note: 'admins exist; left as is'
    }
  const after =
    create_only && page
      ? before
      : [
          ...before,
          ...wanted.filter(
            admin => !before.some(known => known.phone === admin.phone)
          )
        ]
  if (!after.length)
    throw new Error(
      'no first admin: add person.local.html with your telephone link, then rerun'
    )
  if (moved && after.length === before.length)
    return {
      before,
      after,
      changed: false,
      written: false,
      note: 'admins already listed'
    }
  await write_network(storage, page, render_admins(after))
  return { before, after, changed: true, written: true }
}

/** The hint a refused operator sees instead of a bare 403. */
export const not_admin_hint = (env, phone) =>
  `${phone ?? 'this account'} is signed in but is not an admin in ${env}. ` +
  `An admin can run: realness ${env} admins add ${phone ?? '<your phone>'} --yes`

/**
 * Plain text for the terminal; phones are masked by the caller's output rule.
 * @param {{ before: object[], after: object[], changed: boolean, written: boolean, note?: string }} result
 * @param {{ verb?: string }} [options]
 */
export const admins_text = (
  { before, after, changed, written, note },
  { verb = 'list' } = {}
) => {
  const lines = list =>
    list.length
      ? list
          .map(({ phone, name }) => `  ${phone}${name ? `  ${name}` : ''}`)
          .join('\n')
      : '  (none)'
  if (verb === 'list') return `admins:\n${lines(after)}`
  if (verb === 'init') return written ? `first admin:\n${lines(after)}` : note
  if (!changed) return note
  return `${written ? 'wrote' : 'would write (rerun with --yes)'} admins:\n${lines(after)}\nwas:\n${lines(before)}`
}
