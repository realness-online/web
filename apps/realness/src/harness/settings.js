import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const harness_root = (start = process.cwd()) => {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const manifest = join(dir, 'package.json')
    if (
      exists_sync(manifest) &&
      JSON.parse(read_file_sync(manifest, 'utf8')).realness
    )
      return dir
    if (
      ['.ignore', '.pi/agent', 'vault/plans'].some(marker =>
        exists_sync(join(dir, marker))
      )
    )
      return dir
    if (dirname(dir) === dir) return undefined
  }
}

export const is_actor = (root = '/') =>
  exists_sync(join(root, 'etc/realness/actor')) ||
  exists_sync(join(root, 'usr/local/lib/realness/package.json'))

/** The harness-relative plans folder, from package.json's realness.plans. */
export const plans_path = root => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return 'vault/plans'
    throw error
  }
  const path = settings.realness?.plans ?? 'vault/plans'
  if (
    typeof path !== 'string' ||
    !path ||
    path.includes('\\') ||
    path.split('/').some(part => !part || part === '.' || part === '..')
  )
    throw new Error(
      'realness.plans must be a relative folder inside the harness'
    )

  return path
}

/**
 * The harness-relative folder for local sync state (edit log, turns, records,
 * sync.log), from package.json's realness.state. It never syncs.
 */
export const state_path = root => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return '.pi/agent/state'
    throw error
  }
  const path = settings.realness?.state ?? '.pi/agent/state'
  if (
    typeof path !== 'string' ||
    !path ||
    path.includes('\\') ||
    path.split('/').some(part => !part || part === '.' || part === '..')
  )
    throw new Error(
      'realness.state must be a relative folder inside the harness'
    )

  return path
}

/**
 * The untracked page that says who this checkout belongs to, never shared:
 *
 *   <p itemscope itemtype="https://schema.org/Person">
 *     <a itemprop="telephone" href="tel:+14155551234">+14155551234</a> Scott
 *   </p>
 *
 * The name is the text after the link, or, in older pages, the link's text.
 */
export const local_person_file = '.pi/person.local.html'

const read_text = file => {
  try {
    return read_file_sync(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

/** The person on a page: the telephone link's number and the name it shows. */
export const read_person = html => {
  const link =
    html.match(/<a\b[^>]*\bitemprop="telephone"[^>]*>([\s\S]*?)<\/a>([^<]*)/) ??
    html.match(/<a\b[^>]*href="tel:[^"]*"[^>]*>([\s\S]*?)<\/a>([^<]*)/)
  if (!link) return null
  const phone = link[0].match(/href="tel:([^"]*)"/)?.[1]
  const shown = link[1].replace(/<[^>]*>/g, '').trim()
  return { phone, name: link[2].trim() || shown }
}

/** Who this checkout belongs to, from person.local.html, or null. */
export const local_person = root => {
  const html = read_text(join(root, local_person_file))
  if (html === undefined) return null
  const found = read_person(html)
  if (!found)
    throw new Error(
      `${local_person_file} needs a link like <a itemprop="telephone" href="tel:+14155551234">Name</a>`
    )
  return found
}

/**
 * The person this harness mints itemids for, as `/+<phone>`. The untracked
 * person.local.html wins; package.json's realness.person is the older
 * fallback. Null when neither is set: nothing is minted.
 */
export const person = root => {
  const local = local_person(root)
  const settings = local ? undefined : read_text(join(root, 'package.json'))
  const phone =
    local?.phone ??
    (settings === undefined ? undefined : JSON.parse(settings).realness?.person)
  if (phone === undefined || phone === null) return null
  if (typeof phone !== 'string' || !/^\+\d{6,15}$/.test(phone))
    throw new Error('person must be a phone number like +14155551234')
  return `/${phone}`
}

/** Private session records stay in a harness-relative folder inside the vault. */
export const sessions_path = root => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return 'vault/Sessions'
    throw error
  }
  const path =
    settings.realness?.sessions === undefined
      ? 'vault/Sessions'
      : settings.realness.sessions
  if (
    typeof path !== 'string' ||
    !path.startsWith('vault/') ||
    path.includes('\\') ||
    path.split('/').some(part => !part || part === '.' || part === '..')
  )
    throw new Error(
      'realness.sessions must be a relative folder inside the vault'
    )

  return path
}

/** Keep legacy storage until the harness explicitly enables vault sessions. */
export const runtime_sessions_path = root => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return '.pi/agent/sessions'
    throw error
  }
  return settings.realness?.sessions === undefined
    ? '.pi/agent/sessions'
    : sessions_path(root)
}

/** File names in the plans folder that are not plans, from realness.plansIgnore. */
export const plans_ignore = root => {
  let settings
  try {
    settings = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const names = settings.realness?.plansIgnore ?? []
  if (
    !Array.isArray(names) ||
    names.some(
      name =>
        typeof name !== 'string' ||
        !name ||
        name.includes('/') ||
        name.includes('\\')
    )
  )
    throw new Error('realness.plansIgnore must be a list of file names')

  return names
}
