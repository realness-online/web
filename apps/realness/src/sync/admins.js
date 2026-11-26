/**
 * n1: the network is an org. Its founder and members, on
 * `orgs/+realness/members.html`, are the global admins, so the founder adds
 * and removes admins on the account page like any org's members. Read at most
 * every 30 seconds.
 *
 * Until that page exists, the older `admins.html` at the bucket root still
 * names the admins. Pages written before microdata, with `<a href="tel:...">`
 * links, still grant theirs. A malformed page grants nobody.
 */
import { read_people } from '#root/src/can/members.js'
import { members_key, text_of } from './orgs.js'

/** The org whose people run this network. */
export const NETWORK = '+realness'
export const NETWORK_KEY = members_key(NETWORK)
/** The page that named admins before the network was an org. */
export const LEGACY_KEY = 'admins.html'

const TEL = /href="tel:(\+[1-9]\d{6,14})"/g

/** Every admin phone on the page; nobody when the page cannot be read. */
export const read_admins = html => {
  const people = read_people(html)
  if (people.length) return new Set(people.map(person => person.phone))
  return new Set([...html.matchAll(TEL)].map(([, phone]) => phone))
}

/**
 * The network org's page, else the older admins page, else null.
 * @param {{ get: (key: string) => Promise<{ body: Buffer, version?: string } | null> }} storage
 */
export const admins_page = async storage => {
  const network = await storage.get(NETWORK_KEY)
  if (network)
    return { key: NETWORK_KEY, ...network, html: text_of(network.body) }
  const legacy = await storage.get(LEGACY_KEY)
  if (legacy) return { key: LEGACY_KEY, ...legacy, html: text_of(legacy.body) }
  return null
}

/**
 * n4: who runs the network, for anyone, founder first. An older admins page
 * of tel: links gives phones alone.
 * @returns {Promise<{ name: string, phone: string, role: string }[]>}
 */
export const network_people = async storage => {
  const page = await admins_page(storage)
  if (!page) return []
  const people = read_people(page.html)
  if (people.length) return people
  return [...read_admins(page.html)].map((phone, at) => ({
    name: '',
    phone,
    role: at ? 'member' : 'founder'
  }))
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
        const page = await admins_page(storage)
        cached = read_admins(page?.html ?? '')
        until = now() + FRESH_MS
      }
      return cached.has(phone)
    }
  }
}
