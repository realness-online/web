/**
 * hs-n2: which halo serves a person.
 *
 * The choice is written down the first time it is needed and read back after
 * that, so adding or retiring a halo never moves a person who is already
 * placed. Only `reassign` moves someone, and it is what hs-n3 and hs-n4 call
 * when an actor has been recreated elsewhere.
 */
import { createHash as create_hash } from 'node:crypto'
/* eslint-disable no-await-in-loop -- placements are read and removed one at a time so a failure names its key */

const PHONE = /^\+[1-9]\d{6,14}$/
const HALO = /^[a-z0-9][a-z0-9-]{0,62}$/

/** The record that fixes a person's halo. */
export const placement_key = phone => `placements/${phone.slice(1)}.html`

const esc = value =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** Writes both field names; the halo field goes once no reader needs it. */
export const placement_html = ({ phone, halo, placed }) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  if (!HALO.test(halo)) throw new Error('bad halo name')
  const props = Object.entries({ phone, halo, host: halo, placed })
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
  const halo = values.halo ?? values.host
  if (!PHONE.test(values.phone ?? '') || !HALO.test(halo ?? '')) return null
  return { phone: values.phone, halo, placed: values.placed }
}

/** A stable order for halos, so a tie or a retry does not depend on listing order. */
const ranked = (phone, halos) =>
  [...halos].sort((left, right) => score(phone, left) - score(phone, right))

const score = (phone, halo) =>
  create_hash('sha256').update(`${phone}/${halo}`).digest().readUInt32BE(0)

/**
 * The halo already serving this person, or the one the name picks.
 * A person already placed keeps that halo even when the list changes; no live
 * count is read, because a stale count would move people between halos.
 *
 * @param {string} phone
 * @param {{ halos: string[], read: (key: string) => Promise<{ body: Buffer } | null>, write: (key: string, body: string) => Promise<unknown>, now?: () => string }} options
 * @returns {Promise<{ phone: string, halo: string, placed: boolean | string }>}
 */
export const placement = async (
  phone,
  { halos, read, write, now = () => new Date().toISOString() }
) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  const available = [...new Set(halos)].filter(halo => HALO.test(halo)).sort()
  if (!available.length) throw new Error('no halos are configured')

  const held = await read(placement_key(phone))
  const found = held ? read_placement(held.body.toString('utf8')) : null
  if (found) {
    if (!available.includes(found.halo))
      throw new Error(`${found.halo} no longer serves anyone`)
    return { phone: found.phone, halo: found.halo, placed: false }
  }

  const [halo] = ranked(phone, available)

  const record = { phone, halo, placed: now() }
  await write(placement_key(phone), placement_html(record))
  return { ...record, placed: true }
}

/**
 * Move a person to another halo: hs-n3 after a recreate, hs-n4 before a retire.
 * @param {string} phone
 * @param {string} halo
 * @param {{ read: (key: string) => Promise<{ body: Buffer } | null>, write: (key: string, body: string) => Promise<unknown>, now?: () => string }} options
 */
export const reassign = async (
  phone,
  halo,
  { read, write, now = () => new Date().toISOString() }
) => {
  if (!PHONE.test(phone)) throw new Error('bad phone number')
  if (!HALO.test(halo)) throw new Error('bad halo name')
  const held = await read(placement_key(phone))
  if (!held) throw new Error('no placement to move')
  const record = { phone, halo, placed: now() }
  await write(placement_key(phone), placement_html(record))
  return record
}

/**
 * A `halo_for` for the gate from GATE_HALOS: { name: { halo, port, api_port } }.
 * The phone is looked up once and remembered, so the storage read happens on a
 * person's first request and never again.
 */
export const placed_halos = ({ addresses, read, write, now = null }) => {
  if (!addresses || typeof addresses !== 'object')
    throw new Error('placed_halos needs addresses')
  const where = new Map(
    Object.entries(addresses).map(([name, address]) => {
      const { host, port, api_port: api } = address ?? {}
      if (!HALO.test(name) || !host || !Number(port) || !Number(api))
        throw new Error(`bad address for ${name}`)
      return [name, { host, port: Number(port), api_port: Number(api) }]
    })
  )
  const halos = [...where.keys()]
  /** @type {Map<string, { host: string, port: number, api_port: number }>} */
  const known = new Map()
  return async phone => {
    const held = known.get(phone)
    if (held) return held
    const placed = now
      ? await placement(phone, { halos, read, write, now })
      : await placement(phone, { halos, read, write })
    const found = where.get(placed.halo)
    if (!found) throw new Error(`no address for ${placed.halo}`)
    known.set(phone, found)
    return found
  }
}

/**
 * Drop every placement that names this halo, so its people are placed again.
 * hs-n4 calls this once the halo holds no actor; each person is written to a
 * remaining halo on their next request.
 *
 * @param {string} halo
 * @param {{ list: () => Promise<string[]>, read: (key: string) => Promise<{ body: Buffer } | null>, remove: (key: string) => Promise<unknown> }} options
 * @returns {Promise<number>} how many placements named the halo
 */
export const release_placements = async (halo, { list, read, remove }) => {
  if (!HALO.test(halo)) throw new Error('bad halo name')
  const keys = await list()
  let released = 0
  for (const key of keys) {
    const held = await read(key)
    const found = held ? read_placement(held.body.toString('utf8')) : null
    if (!found || found.halo !== halo) continue
    await remove(key)
    released += 1
  }
  return released
}
