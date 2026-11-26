/**
 * w1: each turn reads the person's `sync-hash.html`. A hash unlike the last
 * seen runs `mac_door`: pull, admit, then the turn. The seen hashes are pages
 * too, `sync-seen.html`, kept beside `two-way.json` in the state folder.
 */
import {
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { item_html, read_item } from '#root/lib/items.js'
import { create_gcs, gcloud_token } from '#root/src/can/gcs.js'
import { read_sync_hash, SYNC_HASH } from '#root/src/can/marks.js'
import { store_of } from '#root/src/can/store.js'
import { state_dir, trash_dir } from '#root/src/files/client.js'
import { mac_door } from '#root/src/files/mac-door.js'
import { local_owner } from '#root/src/files/target.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { person_settings } from '#root/src/settings/environments.js'

export const SEEN = 'sync-seen.html'

/** @param {string | null | undefined} html */
export const read_seen = html => {
  const seen = read_item(String(html ?? ''), 'sync-seen') ?? {}
  return {
    vault: seen.vault ?? '',
    quarantine: seen.quarantine ?? '',
    at: seen.at ?? ''
  }
}

/** @param {{ vault: string, quarantine: string }} seen */
export const seen_html = (seen, at = new Date().toISOString()) =>
  item_html('sync-seen', { vault: seen.vault, quarantine: seen.quarantine, at })

/**
 * What the page holds for one person, or null when no page is written yet.
 * @returns {Promise<{ vault: string, quarantine: string, folders: Record<string, string> } | null>}
 */
export const read_page = async (store, phone) => {
  const found = await store.get(`people/${phone}/${SYNC_HASH}`)
  return found ? read_sync_hash(found.body.toString()) : null
}

/**
 * Whether the page holds anything the last seen does not.
 * @param {{ vault: string, quarantine: string } | null} page
 * @param {{ vault: string, quarantine: string }} seen
 */
export const changed = (page, seen) =>
  page !== null &&
  (page.vault !== seen.vault || page.quarantine !== seen.quarantine)

/**
 * One turn's check: on a change, run the door and save what was seen; then say
 * in one line what arrived and what waits. No change means no line.
 * @param {{
 *   store: any, phone: string, record: string, trash: string,
 *   read_seen_page?: () => Promise<string | null>,
 *   save_seen?: (html: string) => Promise<unknown>,
 *   door?: (pass: any) => Promise<{ admitted?: { moved?: string[], waiting?: string[] } }>,
 *   now?: () => Date
 * }} turn
 */
export const turn_check = async ({
  store,
  phone,
  record,
  trash,
  read_seen_page,
  save_seen,
  door,
  now = () => new Date()
}) => {
  const page = await read_page(store, phone)
  if (!page) return null
  const seen = read_seen(await read_seen_page?.())
  if (!changed(page, seen)) return null
  const { admitted = {} } =
    (await door?.({ store, phone, record, trash })) ?? {}
  const waiting = admitted.waiting?.length ?? 0
  await save_seen?.(seen_html(page, now().toISOString()))
  return { page, waiting, moved: admitted.moved?.length ?? 0 }
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
 *   write?: (file: string, html: string) => Promise<unknown>
 * }} [options]
 */
export const turn_at = async ({
  root = find_root(),
  phone = local_owner(root),
  store = store_of(
    create_gcs({
      bucket: person_settings.services.bucket,
      token: gcloud_token()
    })
  ),
  door = mac_door,
  read = file => read_file(file, 'utf8'),
  write = write_file
} = {}) => {
  if (!phone) return null
  const state = state_dir(root)
  const seen_file = join(state, SEEN)
  const result = await turn_check({
    store,
    phone,
    record: join(state, 'two-way.json'),
    trash: trash_dir(use_harness_state(root)),
    read_seen_page: () => read(seen_file).catch(() => null),
    save_seen: html => write(seen_file, html),
    door
  })
  return result ? turn_line(result) : null
}
