/**
 * Global admins: the people listed in `admins.html`, at the bucket root.
 * `can()` denies that key to everyone, so only someone with the bucket's own
 * key edits it. Read at most every 30 seconds.
 *
 * The page is an Organization whose people are members, each showing its
 * telephone as text, so it is read by the microdata reader that reads an
 * org's members page (src/can/members.js):
 *
 *   <p itemprop="founder" itemscope itemtype="https://schema.org/Person">
 *     <span itemprop="name">Scott</span> <span itemprop="telephone">+1 415 666-7777</span>
 *   </p>
 *
 * The founder and every member are admins.
 *
 * Pages written before microdata, with `<a href="tel:...">` links, still
 * grant their admins. A malformed page grants nobody.
 */
import { read_people } from '#root/src/can/members.js'

const TEL = /href="tel:(\+[1-9]\d{6,14})"/g

/** Every admin phone on the page; nobody when the page cannot be read. */
export const read_admins = html => {
  const people = read_people(html)
  if (people.length) return new Set(people.map(person => person.phone))
  return new Set([...html.matchAll(TEL)].map(([, phone]) => phone))
}

const FRESH_MS = 30_000

/**
 * A cached admins list. The page is read at most once per FRESH_MS.
 * @param {{ get: (key: string) => Promise<{ body: Buffer } | null> }} storage
 * @param {{ now?: () => number }} [options]
 */
export const admins = (storage, { now = Date.now } = {}) => {
  /** @type {Set<string> | null} */
  let cached = null
  let until = 0
  return {
    async has(phone) {
      if (!cached || now() >= until) {
        const page = await storage.get('admins.html')
        cached = read_admins(page ? page.body.toString('utf8') : '')
        until = now() + FRESH_MS
      }
      return cached.has(phone)
    }
  }
}
