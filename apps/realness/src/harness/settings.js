import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

/** The harness-relative plans folder, from package.json's brayness.plans. */
export const plans_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return 'vault/plans'
    throw error
  }
  const path = settings.brayness?.plans ?? 'vault/plans'
  if (typeof path !== 'string' || !path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('brayness.plans must be a relative folder inside the harness')
  }
  return path
}

/**
 * The harness-relative folder for local sync state (edit log, turns, records,
 * sync.log), from package.json's brayness.state. It never syncs.
 */
export const state_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return '.pi/agent/state'
    throw error
  }
  const path = settings.brayness?.state ?? '.pi/agent/state'
  if (typeof path !== 'string' || !path || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('brayness.state must be a relative folder inside the harness')
  }
  return path
}

/**
 * The untracked page that says who this checkout belongs to, never shared:
 *
 *   <p itemscope itemtype="https://schema.org/Person">
 *     <a itemprop="telephone" href="tel:+14155551234">Scott</a>
 *   </p>
 */
export const local_person_file = 'person.local.html'

const read_text = (file) => {
  try {
    return read_file_sync(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

/** The person on a page: the telephone link's number and the name it shows. */
export const read_person = (html) => {
  const link = html.match(/<a\b[^>]*\bitemprop="telephone"[^>]*>([\s\S]*?)<\/a>/) ?? html.match(/<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>/)
  if (!link) return null
  const phone = link[0].match(/href="tel:([^"]*)"/)?.[1]
  return { phone, name: link[1].replace(/<[^>]*>/g, '').trim() }
}

/** Who this checkout belongs to, from person.local.html, or null. */
export const local_person = (root) => {
  const html = read_text(join(root, local_person_file))
  if (html === undefined) return null
  const found = read_person(html)
  if (!found) throw new Error(`${local_person_file} needs a link like <a itemprop="telephone" href="tel:+14155551234">Name</a>`)
  return found
}

/**
 * The person this harness mints itemids for, as `/+<phone>`. The untracked
 * person.local.html wins; package.json's brayness.person is the older
 * fallback. Null when neither is set: nothing is minted.
 */
export const person = (root) => {
  const local = local_person(root)
  const settings = local ? undefined : read_text(join(root, 'package.json'))
  const phone = local ? local.phone : settings === undefined ? undefined : JSON.parse(settings).brayness?.person
  if (phone === undefined || phone === null) return null
  if (typeof phone !== 'string' || !/^\+\d{6,15}$/.test(phone)) throw new Error('person must be a phone number like +14155551234')
  return `/${phone}`
}

/** Private session records stay in a harness-relative folder inside the vault. */
export const sessions_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return 'vault/Sessions'
    throw error
  }
  const path = settings.brayness?.sessions === undefined ? 'vault/Sessions' : settings.brayness.sessions
  if (typeof path !== 'string' || !path.startsWith('vault/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('brayness.sessions must be a relative folder inside the vault')
  }
  return path
}

/** Keep legacy storage until the harness explicitly enables vault sessions. */
export const runtime_sessions_path = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return '.pi/agent/sessions'
    throw error
  }
  return settings.brayness?.sessions === undefined ? '.pi/agent/sessions' : sessions_path(root)
}

/** File names in the plans folder that are not plans, from brayness.plansIgnore. */
export const plans_ignore = (root) => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const names = settings.brayness?.plansIgnore ?? []
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name || name.includes('/') || name.includes('\\'))) {
    throw new Error('brayness.plansIgnore must be a list of file names')
  }
  return names
}
