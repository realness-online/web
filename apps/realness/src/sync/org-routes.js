/**
 * Org routes on sync: start an org (sh4), change who is in it (sh5),
 * leave or close it (o7). Each rewrites `members.html` with members_html,
 * guarded by the version it read, so two edits never lose one another.
 *
 *   POST v1/orgs                  { name, founder_name?, members? }  admin
 *   POST v1/orgs/+name/members    { add?: [{ name, phone }], remove?: [phone] }  founder
 *   POST v1/orgs/+name/leave      a member other than the founder
 *   POST v1/orgs/+name/close      { confirm: "+name" }  founder
 *
 * Closing archives every org file into the founder's own folder,
 * `people/+A/archive/orgs/+name/<time>/`, then deletes the org and its
 * commons. Downloaded copies on members' machines stay; sync stops.
 */
/* eslint-disable no-await-in-loop -- archive copies land before the org is deleted */
import { members_html, read_members } from '#root/src/can/members.js'
import { members_key, text_of } from './orgs.js'
import { HTTP } from '#root/lib/http.js'

/** Most people one members page may list. */
const MAX_MEMBERS = 500
/** Longest name a members page keeps. */
const MAX_NAME = 100
const ORG = /^\+[a-z][a-z0-9-]{0,62}$/

export class RouteStatus extends Error {
  constructor(status) {
    super(`org route ${status}`)
    this.status = status
  }
}
const refuse = status => {
  throw new RouteStatus(status)
}

/** The org's page and its reading, or a 404. */
const read_page = async (storage, name) => {
  const page = await storage.get(members_key(name))
  if (!page) refuse(HTTP.NOT_FOUND)
  try {
    return { version: page.version, org: read_members(text_of(page.body)) }
  } catch {
    return refuse(HTTP.CONFLICT)
  }
}

const people_of = org => ({
  founder: org.people.find(person => person.role === 'founder'),
  members: org.people.filter(person => person.role === 'member')
})

const write_page = (storage, name, page, guard) =>
  storage
    .put(members_key(name), members_html({ name, ...page }), guard)
    .catch(error => {
      if (error.code === 'conflict') refuse(HTTP.PRECONDITION_FAILED)
      throw error
    })

const clean_person = person => {
  if (!person || typeof person.phone !== 'string') refuse(HTTP.BAD_REQUEST)
  const name = typeof person.name === 'string' ? person.name.trim() : ''
  if (name.length > MAX_NAME) refuse(HTTP.BAD_REQUEST)
  return { name, phone: person.phone.replace(/[\s().-]/g, '') }
}

const guarded =
  fn =>
  async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error.message?.startsWith('members page')) refuse(HTTP.BAD_REQUEST)
      throw error
    }
  }

/** sh4: an admin starts an org as its founder. */
const create_org = async ({ storage, who, body }) => {
  if (!who.admin) refuse(HTTP.FORBIDDEN)
  const { name, founder_name = '', members = [] } = body ?? {}
  if (typeof name !== 'string' || !ORG.test(name)) refuse(HTTP.BAD_REQUEST)
  if (!Array.isArray(members) || members.length > MAX_MEMBERS)
    refuse(HTTP.BAD_REQUEST)
  const page = {
    founder: clean_person({ name: founder_name, phone: who.phone }),
    members: members.map(clean_person)
  }
  await guarded(write_page)(storage, name, page, { if_absent: true })
  return { name }
}

/** sh5: the founder adds and removes members. */
const change_members = async ({ storage, who, name, body }) => {
  const { version, org } = await read_page(storage, name)
  if (org.founder !== who.phone) refuse(HTTP.FORBIDDEN)
  const { add = [], remove = [] } = body ?? {}
  if (!Array.isArray(add) || !Array.isArray(remove)) refuse(HTTP.BAD_REQUEST)
  if (remove.includes(org.founder)) refuse(HTTP.BAD_REQUEST)
  const { founder, members } = people_of(org)
  const gone = new Set(remove)
  const kept = members.filter(person => !gone.has(person.phone))
  const added = add.map(clean_person)
  const known = new Set(kept.map(person => person.phone))
  const page = {
    founder,
    members: [...kept, ...added.filter(person => !known.has(person.phone))]
  }
  await guarded(write_page)(storage, name, page, { if_version: version })
  return { members: [founder, ...page.members].map(person => person.phone) }
}

/** o7: a member other than the founder takes themselves off the list. */
const leave_org = async ({ storage, who, name }) => {
  const { version, org } = await read_page(storage, name)
  if (!org.members.includes(who.phone)) refuse(HTTP.FORBIDDEN)
  if (org.founder === who.phone) refuse(HTTP.CONFLICT)
  const { founder, members } = people_of(org)
  const page = {
    founder,
    members: members.filter(person => person.phone !== who.phone)
  }
  await write_page(storage, name, page, { if_version: version })
  return { left: name }
}

/** o7: the founder closes the org; its files move into their archive. */
const close_org = async ({ storage, who, name, body, now = Date.now }) => {
  const { org } = await read_page(storage, name)
  if (org.founder !== who.phone) refuse(HTTP.FORBIDDEN)
  if (body?.confirm !== name) refuse(HTTP.BAD_REQUEST)
  const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-')
  const archive = `people/${who.phone}/archive/orgs/${name}/${stamp}/`
  const files = Object.keys(await storage.walk(`orgs/${name}/`))
  for (const file of files) {
    const stored = await storage.get(`orgs/${name}/${file}`)
    if (stored)
      await storage.put(`${archive}${file}`, stored.body, {
        meta: stored.meta ?? {}
      })
  }
  const published = Object.keys(await storage.walk(`commons/${name}/`))
  for (const file of published) await storage.delete(`commons/${name}/${file}`)
  for (const file of files.filter(file => file !== 'members.html'))
    await storage.delete(`orgs/${name}/${file}`)
  await storage.delete(members_key(name))
  return { archive, files: files.length, withdrawn: published.length }
}

/** The org route a request names, or null. */
export const org_route = (path, method) => {
  if (method !== 'POST') return null
  if (path === 'v1/orgs') return { route: create_org }
  const match = path.match(
    /^v1\/orgs\/(\+[a-z][a-z0-9-]{0,62})\/(members|leave|close)$/
  )
  if (!match) return null
  const routes = { members: change_members, leave: leave_org, close: close_org }
  return { route: routes[match[2]], name: match[1] }
}
