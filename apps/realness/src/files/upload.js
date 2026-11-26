/**
 * The Mac's own upload: its files, one way, at the same path in the store as
 * on the Mac (`people/<phone>/vault/`, `people/<phone>/AGENTS.md`). Only this
 * machine writes its lane, with its own Google account, so no sync pass is
 * needed and no delete ever travels. A file the Mac never wrote stays as it is.
 */
import { readFile as read_file, readdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute as is_absolute, join, normalize } from 'node:path'
import { MAX_BYTES } from '#root/src/files/client.js'
import { MEMORY_FOLDER, MEMORY_LOCAL } from '#root/src/files/own.js'
import { skipped } from '#root/src/files/skip.js'
import { syncs_of } from '#root/src/harness/harness.js'
import { version_sync } from '#root/src/files/version-node.js'
/* eslint-disable no-await-in-loop -- one file at a time bounds open handles */

/** What the Mac writes to its lane, in the order it uploads them. */
export const UPLOAD = ['vault', 'AGENTS.md', '.ignore', 'rights.html']

/** How many files upload at the same time. */
const AT_ONCE = 16

/** Where the lane starts, the same path the files have on the Mac. */
export const upload_root = ({ phone }) => `people/${phone}/`

/** A `work/` path a vault page names, as a `/`-separated path under the root. */
const WORK = /^work\//

/**
 * The `work/` paths a vault page names: a markdown link beside the note, or a
 * `## Syncs` item. A page that names nothing leaves its work at home.
 * @param {string} path the note's path
 * @param {string} text the note's text
 * @returns {string[]}
 */
const work_refs = (path, text) => {
  const linked = [...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(([, href]) => href.trim().replace(/^<|>$/g, ''))
    .filter(href => href && !href.startsWith('/') && !href.startsWith('#'))
    .filter(href => !/^[a-z]+:/i.test(href))
    .map(href => normalize(join(dirname(path), decodeURIComponent(href))))
  const named = syncs_of(text).map(item => normalize(item))
  return [...linked, ...named]
    .map(found => found.split('\\').join('/').replace(/\/+$/, ''))
    .filter(found => !is_absolute(found) && WORK.test(found) && !skipped(found))
}

/**
 * @param {{ root: string, store: any, phone: string }} options
 */
export const upload = async ({ root, store, phone }) => {
  const base = upload_root({ phone })
  const report = { pushed: [], unchanged: [], too_big: [] }
  const files = []
  for (const name of UPLOAD)
    for (const path of await local_paths(root, name)) files.push({ path })
  for (const { local, remote } of await work_files(root))
    files.push({ path: remote, from: local })
  for (const path of await local_paths(root, MEMORY_LOCAL))
    files.push({
      path: `${MEMORY_FOLDER}/${path.slice(MEMORY_LOCAL.length + 1)}`,
      from: path
    })
  const next = files.values()
  const lane = async () => {
    for (const file of next)
      await put_file({ base, ...file, report, root, store })
  }
  await Promise.all(Array.from({ length: AT_ONCE }, lane))
  return report
}

/**
 * Every file the vault's pages name in `work/`, as its local path and the path
 * it lands at.
 * @param {string} root
 * @returns {Promise<{ local: string, remote: string }[]>}
 */
const work_files = async root => {
  const notes = (await local_paths(root, 'vault')).filter(path =>
    path.endsWith('.md')
  )
  const named = (
    await Promise.all(
      notes.map(async path =>
        work_refs(path, await read_file(join(root, path), 'utf8'))
      )
    )
  ).flat()
  const kept = [...new Set(named)].filter(
    (path, at, all) =>
      !all.some(other => other !== path && path.startsWith(`${other}/`))
  )
  const found = await Promise.all(
    kept.map(async path =>
      (await local_paths(root, path)).map(local => ({ local, remote: local }))
    )
  )
  return found.flat()
}

/**
 * One file, uploaded when its version differs. A guarded write means a file
 * this Mac has not seen is never overwritten blind.
 * @param {{ base: string, path: string, from?: string, report: { pushed: string[], unchanged: string[], too_big: string[] }, root: string, store: any }} run
 */
const put_file = async ({ base, path, from = path, report, root, store }) => {
  const bytes = await read_file(join(root, from))
  if (bytes.byteLength > MAX_BYTES) {
    report.too_big.push(path)
    return
  }
  const version = version_sync(bytes)
  const key = `${base}${path}`
  const current = await store.stat(key)
  if (current === version) {
    report.unchanged.push(path)
    return
  }
  await store.put(
    key,
    bytes,
    current === null ? { if_absent: true } : { if_version: current }
  )
  report.pushed.push(path)
}

/**
 * Every file at `path`, as `/`-separated names under the harness root, or an
 * empty list when the Mac does not have it. A name the harness always skips
 * stays on the Mac.
 * @param {string} root
 * @param {string} path
 * @returns {Promise<string[]>}
 */
export const local_paths = async (root, path) => {
  const target = join(root, path)
  const entry = await stat(target).catch(() => null)
  if (!entry) return []
  if (entry.isFile()) return [path]
  const found = []
  for (const child of await readdir(target, { withFileTypes: true })) {
    if (skipped(child.name)) continue
    const child_path = `${path}/${child.name}`
    if (child.isDirectory())
      found.push(...(await local_paths(root, child_path)))
    else if (child.isFile()) found.push(child_path)
  }
  return found
}
