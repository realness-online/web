/**
 * k2, c1: read the changes actors returned, check each, and move the ones that
 * pass into the person's own files. The Mac runs this over its files; the
 * cloud runs the same code over its own copy, so a change lands while the Mac
 * sleeps. The rest wait, listed with their reasons on `vault/Waiting.html`.
 */
import {
  mkdir,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { HTTP } from '#root/lib/http.js'
import { item_html, read_items } from '#root/lib/items.js'
import { to_trash } from '#root/src/files/client.js'
import { WAITING_PAGE } from '#root/src/sync/quarantine.js'
import { REFUSALS_PAGE } from '#root/src/sync/refusals.js'
import { version_sync } from '#root/src/files/version-node.js'
import { reasons_to_wait } from './admit-checks.js'
/* eslint-disable no-await-in-loop -- changes apply in order, and a lost race reads again */

/** The person's page of changes that wait. */
export const WAITING_NOTE = 'vault/Waiting.html'

const WAITING = `can://~/quarantine/${WAITING_PAGE}`
const REFUSALS = `can://~/quarantine/${REFUSALS_PAGE}`

/**
 * A remote file's bytes, or null when it is gone.
 * @param {{ cat: (path: string) => Promise<Buffer> }} store
 * @param {string} path
 */
const remote_bytes = async (store, path) => {
  try {
    return await store.cat(path)
  } catch (error) {
    if (error.status === HTTP.NOT_FOUND) return null
    throw error
  }
}

/**
 * The Mac's copy of a file, or null when it has none.
 * @param {string} root
 * @param {string} path
 */
const local_bytes = (root, path) =>
  read_file(join(root, path)).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })

/**
 * A folder tree on the machine's disk: read a path, write one, move one aside.
 * @param {string} root
 * @param {string | undefined} trash
 */
const disk_tree = (root, trash) => ({
  read: path => local_bytes(root, path),
  write: async (path, bytes) => {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await write_file(target, bytes)
  },
  trash: path => to_trash(join(root, path), trash)
})

/**
 * The page the person reads: every change that waits and why, then the
 * writes sync refused, as sync recorded them.
 * @param {Record<string, unknown>[]} waiting
 * @param {Record<string, string>[]} refused
 */
const waiting_page = (waiting, refused) => `<!doctype html>
<html lang="en" itemscope itemtype="https://schema.org/WebPage">
<head><meta charset="utf-8" /><title>Waiting changes</title></head>
<body><main>
<h1 itemprop="name">Waiting changes</h1>
<p>Changes actors returned that did not pass the checks, newest first.</p>
${waiting.map(change => item_html('waiting', change)).join('')}<h2>Refused writes</h2>
<p>Writes sync turned away, newest first.</p>
${refused.map(refusal => item_html('refusal', refusal)).join('')}</main></body>
</html>
`

/** One change, as it is named on the quarantine page. */
const key_of = change => `${change.actor}\n${change.path}\n${change.at}`

/** The reason a change waits when its file moved as it arrived. */
const MOVED = 'the file changed since the actor started'

/**
 * Drop the held bytes, only while they are the ones this change listed.
 * @param {any} store
 * @param {string} held
 * @param {string | undefined} version
 */
const drop_held = async (store, held, version) => {
  try {
    await store.rm(held, version ? { 'if-match': `"${version}"` } : undefined)
  } catch (error) {
    if (error.status !== HTTP.PRECONDITION_FAILED) throw error
  }
}

/**
 * Take the changes that moved off the quarantine page. Actors add to it as
 * this runs, so each write is guarded and a lost race reads again.
 * @param {any} store
 * @param {Set<string>} done
 */
const clear_moved = async (store, done) => {
  for (let tries = 0; tries < 3; tries++) {
    const version = await store.version(WAITING)
    if (!version) return
    const page = (await store.cat(WAITING)).toString('utf8')
    const kept = page.replace(
      /<article itemscope itemtype="\/change">[\s\S]*?<\/article>\n?/g,
      item => {
        const [change] = read_items(item, 'change')
        return done.has(key_of(change)) ? '' : item
      }
    )
    try {
      await store.put(WAITING, Buffer.from(kept), {
        'if-match': `"${version}"`
      })
      return
    } catch (error) {
      if (error.status !== HTTP.PRECONDITION_FAILED) throw error
    }
  }
}

/**
 * @param {{ root?: string, store: any, phone: string, trash?: string, read?: typeof local_bytes, tree?: { read: (path: string) => Promise<Buffer | null>, write: (path: string, bytes: Buffer, version?: string) => Promise<unknown>, trash: (path: string) => Promise<unknown> } }} options
 * @returns {Promise<{ moved: string[], waiting: string[] }>}
 */
export const admit = async ({
  root = '',
  store,
  phone,
  trash,
  read,
  tree = disk_tree(root, trash)
}) => {
  const look = read ? path => read(root, path) : tree.read
  const page = await remote_bytes(store, WAITING)
  const changes = page ? read_items(page.toString('utf8'), 'change') : []
  const moved = []
  const waiting = []
  const done = new Set()
  for (const change of changes.toReversed()) {
    const held =
      change.held === 'nothing kept'
        ? null
        : `can://${change.held.replace(/^people\/[^/]+\//, '~/')}`
    const bytes = held ? await remote_bytes(store, held) : null
    if (held && !bytes) {
      done.add(key_of(change))
      continue
    }
    const local = await look(change.path)
    const reasons = reasons_to_wait(change, { bytes, local, phone })
    if (reasons.length) {
      waiting.unshift({ ...change, reasons })
      continue
    }
    const now = await look(change.path)
    const current = now ? version_sync(now) : 'new'
    if (current !== change.base) {
      waiting.unshift({ ...change, reasons: [MOVED] })
      continue
    }
    if (bytes && held) {
      try {
        await tree.write(change.path, bytes, current)
      } catch (error) {
        if (error.code !== 'conflict') throw error
        waiting.unshift({ ...change, reasons: [MOVED] })
        continue
      }
      await drop_held(store, held, change.held_version)
    } else if (now) await tree.trash(change.path)
    moved.push(change.path)
    done.add(key_of(change))
  }
  if (done.size) await clear_moved(store, done)
  const refusals = await remote_bytes(store, REFUSALS)
  const refused = refusals
    ? read_items(refusals.toString('utf8'), 'refusal')
    : []
  await tree.write(WAITING_NOTE, Buffer.from(waiting_page(waiting, refused)))
  return { moved, waiting: waiting.map(change => change.path) }
}
