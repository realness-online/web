/**
 * Manage an environment's global admins: `admins.html` at the bucket root.
 * Sync reads it (src/sync/admins.js) and `can()` denies the key to everyone,
 * so only the bucket owner's credentials write it. This is that writer.
 *
 * The page is an Organization whose people are members, read by the same
 * microdata reader as an org's members page (src/can/members.js):
 *
 *   <p><span itemprop="name">Scott</span> <span itemprop="telephone">+1 415 666 7777</span></p>
 *
 * What the page shows is what admits: the telephone is on a span, whose
 * microdata value is its text, laid out as +1 415 666-7777 while the phone
 * is stored as digits. Sync's reader accepts an older page of tel: links.
 *
 * Writes are conditional on the version that was read, so two operators
 * cannot silently overwrite each other. Removing the last admin is refused.
 */
import { read_admins } from '#root/src/sync/admins.js'
import { read_people } from '#root/src/can/members.js'
import { escape, unescape } from '#root/lib/items.js'

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

/** A displayed number, laid out for reading, never for parsing. */
const shown_phone = phone => {
  const [, code, area = '', head = '', tail = ''] =
    /^\+(\d)(\d{3})(\d{3})(\d{4})$/.exec(phone) ?? []
  return code ? `+${code} ${area} ${head}-${tail}` : phone
}

const person_html = (role, { phone, name }, tag) =>
  `<${tag} itemprop="${role}" itemscope itemtype="https://schema.org/Person">${
    name ? `<span itemprop="name">${escape(name)}</span> ` : ''
  }<span itemprop="telephone">${shown_phone(phone)}</span></${tag}>`

/**
 * The page sync reads; `read_admins` must see exactly these phones. The first
 * admin leads as the organization's founder, the rest follow as members, and
 * everyone on it is an admin.
 */
export const render_admins = list => {
  const [admin, ...others] = list
  if (!admin) throw new Error('an admins page needs one admin')
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Admins</title></head>
<body>
<article itemscope itemtype="https://schema.org/Organization">
<h1 itemprop="name">Realness admins</h1>
${person_html('founder', admin, 'p')}
<ul>
${others.map(person => person_html('member', person, 'li')).join('\n')}
</ul>
</article>
</body>
</html>
`
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
  const page = await storage.get('admins.html')
  const before = parse_admins(page ? page.body.toString('utf8') : '')
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
  await storage.put(
    'admins.html',
    html,
    page ? { if_version: page.version } : { if_absent: true }
  )
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
  const page = await storage.get('admins.html')
  const before = parse_admins(page ? page.body.toString('utf8') : '')
  if (page && create_only)
    return {
      before,
      after: before,
      changed: false,
      written: false,
      note: 'admins.html exists; left as is'
    }
  const after = [
    ...before,
    ...wanted.filter(
      admin => !before.some(known => known.phone === admin.phone)
    )
  ]
  if (!after.length)
    throw new Error(
      'no first admin: add person.local.html with your telephone link, then rerun'
    )
  if (page && after.length === before.length)
    return {
      before,
      after,
      changed: false,
      written: false,
      note: 'admins already listed'
    }
  await storage.put(
    'admins.html',
    render_admins(after),
    page ? { if_version: page.version } : { if_absent: true }
  )
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
