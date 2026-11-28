/**
 * w1: each turn reads the person's `sync-hash.html`, each of their orgs'
 * `orgs/+name/sync-hash.html`, and the Mac's file dates. A folder whose hash
 * moved, or with a file saved since the last run, goes through `mac_door`:
 * both ways, then admit. The seen hashes are pages
 * too, `sync-seen.html`, kept beside `two-way.json` in the state folder.
 */
import {
  readdir,
  readFile as read_file,
  stat,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { item_html, read_item, read_items } from '#root/lib/items.js'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { read_sync_hash, SYNC_HASH } from '#root/src/can/marks.js'
import { store_of } from '#root/src/can/store.js'
import { state_dir, trash_dir } from '#root/src/files/client.js'
import { mac_door } from '#root/src/files/mac-door.js'
import { local_owner } from '#root/src/files/target.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { person_settings } from '#root/src/settings/environments.js'
import { orgs_of } from '#root/src/sync/orgs.js'

export const SEEN = 'sync-seen.html'

/** @param {string | null | undefined} html */
export const read_seen = html => {
  const seen = read_item(String(html ?? ''), 'sync-seen') ?? {}
  return {
    vault: seen.vault ?? '',
    quarantine: seen.quarantine ?? '',
    at: seen.at ?? '',
    folders: Object.fromEntries(
      read_items(String(html ?? ''), 'folder').map(({ name, hash }) => [
        name,
        hash
      ])
    )
  }
}

/** @param {{ vault: string, quarantine: string, folders?: Record<string, string> }} seen */
export const seen_html = (seen, at = new Date().toISOString()) =>
  item_html('sync-seen', {
    vault: seen.vault,
    quarantine: seen.quarantine,
    at
  }) +
  Object.entries(seen.folders ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, hash]) => item_html('folder', { name, hash }))
    .join('')

/**
 * The folders whose hash moved since the last seen, gone ones included.
 * @param {{ quarantine: string, folders: Record<string, string> }} page
 * @param {{ quarantine: string, folders: Record<string, string> }} seen
 */
export const changed_folders = (page, seen) => {
  const names = new Set([
    ...Object.keys(page.folders),
    ...Object.keys(seen.folders)
  ])
  const moved = [...names]
    .filter(name => page.folders[name] !== seen.folders[name])
    .sort()
  return page.quarantine === seen.quarantine ? moved : [...moved, 'quarantine']
}

/**
 * What the page holds for one person, or null when no page is written yet.
 * @returns {Promise<{ vault: string, quarantine: string, folders: Record<string, string> } | null>}
 */
export const read_page = async (store, phone) => {
  const found = await store.get(`people/${phone}/${SYNC_HASH}`)
  return found ? read_sync_hash(found.body.toString()) : null
}

/**
 * Every org folder hash the person can see, named as the Mac names the
 * folder: `orgs/+name/dir`, or `orgs/+name` for its top files. An org with no
 * page yet gets one built, when the store can build it.
 * @returns {Promise<Record<string, string>>}
 */
export const read_org_folders = async (store, phone) => {
  const one = async org => {
    const key = `orgs/${org}/${SYNC_HASH}`
    if (!(await store.stat(key))) await store.rebuild_org?.(org)
    const page = await store.get(key)
    if (!page) return []
    const { folders } = read_sync_hash(page.body.toString())
    return Object.entries(folders).map(([name, hash]) => [
      name === '.' ? `orgs/${org}` : `orgs/${org}/${name}`,
      hash
    ])
  }
  const orgs = await orgs_of(store, phone)
  return Object.fromEntries((await Promise.all(orgs.map(one))).flat())
}

/**
 * Whether the page holds anything the last seen does not.
 * @param {{ vault: string, quarantine: string } | null} page
 * @param {{ vault: string, quarantine: string }} seen
 */
export const changed = (page, seen) =>
  page !== null &&
  (page.vault !== seen.vault || page.quarantine !== seen.quarantine)

/** The sync folder a path under `vault/` belongs to. */
const vault_folder = (name, is_dir) => {
  const slash = name.indexOf('/')
  if (slash !== -1) return `vault/${name.slice(0, slash)}`
  return is_dir && name ? `vault/${name}` : 'vault'
}

/**
 * The names under one top folder with their file dates; none when the folder
 * is not on this machine.
 * @param {string} root @param {string} top
 * @returns {Promise<{ name: string, info: Awaited<ReturnType<typeof stat>> | null }[]>}
 */
const top_infos = async (root, top) => {
  const names = await readdir(join(root, top), { recursive: true }).catch(
    () => null
  )
  if (!names) return []
  return Promise.all(
    ['', ...names].map(async name => ({
      name,
      info: await stat(join(root, top, name)).catch(() => null)
    }))
  )
}

/** The org folder a path under `orgs/` belongs to, or null at the top. */
const org_folder = (name, is_dir) => {
  const folder = is_dir ? name : dirname(name)
  return folder && folder !== '.' ? `orgs/${folder}` : null
}

/** The sync folder one saved path belongs to. */
const folder_for = (top, name, is_dir) => {
  if (top === 'quarantine') return top
  if (top === 'orgs') return org_folder(name, is_dir)
  return vault_folder(name, is_dir)
}

/**
 * The folders on the Mac with a file or folder saved after `since`. A folder
 * date moves on a delete, so deletes count. No `since` means every folder.
 * @param {string} root
 * @param {string} since
 */
export const edited_folders = async (root, since) => {
  const after = since ? Date.parse(since) : -Infinity
  const found = new Set()
  const tops = await Promise.all(
    ['vault', 'quarantine', 'orgs'].map(async top => ({
      top,
      infos: await top_infos(root, top)
    }))
  )
  for (const { top, infos } of tops)
    for (const { name, info } of infos)
      if (info && info.mtimeMs > after) {
        const folder = folder_for(top, name, info.isDirectory())
        if (folder) found.add(folder)
      }
  return [...found].sort()
}

/**
 * One turn's check: on a change, run the door and save what was seen; then say
 * in one line what arrived and what waits. No change means no line.
 * @param {{
 *   root: string, store: any, phone: string, record: string, trash: string,
 *   read_seen_page?: () => Promise<string | null>,
 *   save_seen?: (html: string) => Promise<unknown>,
 *   door?: (pass: any) => Promise<{ admitted?: { moved?: string[], waiting?: string[] } }>,
 *   on_start?: (folders: string[]) => unknown,
 *   edited?: (since: string) => string[] | Promise<string[]>,
 *   now?: () => Date
 * }} turn
 */
export const turn_check = async ({
  root,
  store,
  phone,
  record,
  trash,
  read_seen_page,
  save_seen,
  door,
  on_start,
  edited = () => [],
  now = () => new Date()
}) => {
  const own = await read_page(store, phone)
  if (!own) return null
  const page = {
    ...own,
    folders: { ...own.folders, ...(await read_org_folders(store, phone)) }
  }
  const seen = read_seen(await read_seen_page?.())
  const started = now().toISOString()
  const remote = changed_folders(page, seen)
  const whole = changed(own, seen) && !remote.length
  const folders = whole
    ? undefined
    : [...new Set([...remote, ...(await edited(seen.at))])].sort()
  if (folders && !folders.length) return null
  on_start?.(folders ?? ['everything'])
  const { admitted = {} } =
    (await door?.({ root, store, phone, record, trash, folders })) ?? {}
  const waiting = admitted.waiting?.length ?? 0
  await save_seen?.(seen_html(page, started))
  return { page, folders, waiting, moved: admitted.moved?.length ?? 0 }
}

/** The one line a turn starts with. */
export const turn_line = ({ page, waiting, moved }) =>
  `Sync: ${moved} arrived, ${waiting} wait${
    page.quarantine ? ', new files in the cloud queue' : ''
  }`
/**
 * One turn of the harness: check the owner's cloud page, and on a change run
 * the Mac's door. Returns the line the turn starts with, or null.
 * @param {{
 *   root?: string, phone?: string, store?: any,
 *   door?: (pass: any) => Promise<{ admitted?: { moved?: string[], waiting?: string[] } }>,
 *   read?: (file: string) => Promise<string>,
 *   write?: (file: string, html: string) => Promise<unknown>,
 *   on_start?: (folders: string[]) => unknown
 * }} [options]
 */
export const turn_at = async ({
  root = find_root(),
  phone = local_owner(root),
  store = store_of(
    create_gcs({
      bucket: person_settings.services.bucket,
      token: gcloud_token()
    }),
    { marks: true }
  ),
  door = mac_door,
  read = file => read_file(file, 'utf8'),
  write = write_file,
  on_start
} = {}) => {
  if (!phone) return null
  const state = state_dir(root)
  const seen_file = join(state, SEEN)
  const result = await turn_check({
    root,
    store,
    phone,
    record: join(state, 'two-way.json'),
    trash: trash_dir(use_harness_state(root)),
    read_seen_page: () => read(seen_file).catch(() => null),
    save_seen: html => write(seen_file, html),
    door,
    on_start,
    edited: since => edited_folders(root, since)
  })
  return result ? turn_line(result) : null
}
