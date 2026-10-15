/**
 * hs-n2: which host serves a person.
 *
 * The choice is written down the first time it is needed and read back after
 * that, so adding or retiring a host never moves a person who is already
 * placed. Only `reassign` moves someone, and it is what hs-n3 and hs-n4 call
 * when an actor has been recreated elsewhere.
 */
import { createHash } from 'node:crypto'

const PHONE = /^\+[1-9]\d{6,14}$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/

/** The record that fixes a person's host. */
export const placement_key = phone => `placements/${phone.slice(1)}.html`

const esc = value =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

export const placement_html = ({ phone, host, placed }) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  if (!HOST.test(host)) throw new Error('bad host name')
  const props = Object.entries({ phone, host, placed })
    .map(([name, value]) => `<meta itemprop="${name}" content="${esc(value)}">`)
    .join('')
  return `<article itemscope itemtype="/placement">${props}</article>\n`
}

/** The placement, or null for anything malformed. */
export const read_placement = html => {
  const match = String(html).match(
    /<article itemscope itemtype="\/placement">(.*?)<\/article>/s
  )
  if (!match) return null
  const values = {}
  for (const [, name, value] of match[1].matchAll(
    /itemprop="(\w+)" content="([^"]*)"/g
  ))
    values[name] = value
      .replace(/&lt;/g, '<')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  if (!PHONE.test(values.phone ?? '') || !HOST.test(values.host ?? ''))
    return null
  return values
}

/** A stable order for hosts, so a tie or a retry does not depend on listing order. */
const ranked = (phone, hosts) =>
  [...hosts].sort((left, right) => score(phone, left) - score(phone, right))

const score = (phone, host) =>
  createHash('sha256').update(`${phone}/${host}`).digest().readUInt32BE(0)

/**
 * The host already serving this person, or the one the name picks.
 * A person already placed keeps that host even when the list changes; no live
 * count is read, because a stale count would move people between hosts.
 *
 * @param {string} phone
 * @param {{ hosts: string[], read: (key: string) => Promise<{ body: Buffer } | null>, write: (key: string, body: string) => Promise<unknown>, now?: () => string }} options
 * @returns {Promise<{ phone: string, host: string, placed: boolean | string }>}
 */
export const placement = async (
  phone,
  { hosts, read, write, now = () => new Date().toISOString() }
) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  const available = [...new Set(hosts)].filter(host => HOST.test(host)).sort()
  if (!available.length) throw new Error('no hosts are configured')

  const held = await read(placement_key(phone))
  const found = held ? read_placement(held.body.toString('utf8')) : null
  if (found) {
    if (!available.includes(found.host))
      throw new Error(`${found.host} no longer serves anyone`)
    return { phone: found.phone, host: found.host, placed: false }
  }

  const [host] = ranked(phone, available)

  const record = { phone, host, placed: now() }
  await write(placement_key(phone), placement_html(record))
  return { ...record, placed: true }
}

/**
 * Move a person to another host: hs-n3 after a recreate, hs-n4 before a retire.
 * @param {string} phone
 * @param {string} host
 * @param {{ read: (key: string) => Promise<{ body: Buffer } | null>, write: (key: string, body: string) => Promise<unknown>, now?: () => string }} options
 */
export const reassign = async (
  phone,
  host,
  { read, write, now = () => new Date().toISOString() }
) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  if (!HOST.test(host)) throw new Error('bad host name')
  const held = await read(placement_key(phone))
  if (!held) throw new Error('no placement to move')
  const record = { phone, host, placed: now() }
  await write(placement_key(phone), placement_html(record))
  return record
}

/**
 * A `host_for` for the gate from GATE_HOSTS: { name: { host, port, api_port } }.
 * The phone is looked up once and remembered, so the storage read happens on a
 * person's first request and never again.
 */
export const placed_hosts = ({ addresses, read, write, now = null }) => {
  if (!addresses || typeof addresses !== 'object')
    throw new Error('placed_hosts needs addresses')
  const where = new Map(
    Object.entries(addresses).map(([name, address]) => {
      const { host, port, api_port: api } = address ?? {}
      if (!HOST.test(name) || !host || !Number(port) || !Number(api))
        throw new Error(`bad address for ${name}`)
      return [name, { host, port: Number(port), api_port: Number(api) }]
    })
  )
  const hosts = [...where.keys()]
  /** @type {Map<string, { host: string, port: number, api_port: number }>} */
  const known = new Map()
  return async phone => {
    const held = known.get(phone)
    if (held) return held
    const placed = now
      ? await placement(phone, { hosts, read, write, now })
      : await placement(phone, { hosts, read, write })
    const found = where.get(placed.host)
    if (!found) throw new Error(`no address for ${placed.host}`)
    known.set(phone, found)
    return found
  }
}
