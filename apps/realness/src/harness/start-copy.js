/**
 * k3: what an actor's own files held when it started, one item per file with
 * the version it had. `realness return` compares the files with this page to
 * find what the actor changed, and sends those changes, with the version each
 * started from, to quarantine.
 */
import {
  readFile as read_file,
  readdir,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { item_html, read_items } from '#root/lib/items.js'
import { holds_synced, is_synced } from '#root/src/files/own.js'
import { skipped } from '#root/src/files/skip.js'
import { version_sync } from '#root/src/files/version-node.js'

/** The page, in the actor's own state folder. */
const START_PAGE = 'start-copy.html'

/**
 * Every file a person owns under `folder`, as `/`-separated paths under
 * `root`: the files the start copy brings, and the actor may return.
 * @param {string} root
 * @param {string} [folder]
 * @returns {Promise<string[]>}
 */
const files_in = async (root, folder = '') => {
  const entries = await readdir(join(root, folder), {
    withFileTypes: true
  }).catch(() => [])
  const found = await Promise.all(
    entries.map(entry => {
      const path = folder ? `${folder}/${entry.name}` : entry.name
      if (skipped(entry.name)) return []
      if (entry.isDirectory())
        return holds_synced(path) ? files_in(root, path) : []
      return entry.isFile() && is_synced(path) ? [path] : []
    })
  )
  return found.flat()
}

/**
 * The actor's own files as they are now: path to version.
 * @param {string} root
 * @returns {Promise<Map<string, string>>}
 */
export const own_versions = async root => {
  const paths = await files_in(root)
  const versions = await Promise.all(
    paths.map(async path => version_sync(await read_file(join(root, path))))
  )
  return new Map(paths.map((path, at) => [path, versions[at]]))
}

/**
 * Write the page from the vault as it is now.
 * @param {string} root
 * @param {string} state
 * @param {Map<string, string>} [versions]
 */
export const write_start_copy = async (root, state, versions) => {
  const now = versions ?? (await own_versions(root))
  const items = [...now]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, version]) => item_html('file', { path, version }))
    .join('')
  await write_file(
    join(state, START_PAGE),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Start copy</title></head>
<body><main><h1>Start copy</h1>
${items}</main></body></html>
`
  )
}

/**
 * A file fetched after the start copy joins it, so a later return does not
 * take it for the actor's own work.
 * @param {string} root
 * @param {string} state
 * @param {string} path
 */
export const add_to_start_copy = async (root, state, path) => {
  const started = await read_start_copy(state)
  started.set(path, version_sync(await read_file(join(root, path))))
  await write_start_copy(root, state, started)
}

/**
 * The page's files: path to the version it started at.
 * @param {string} state
 * @returns {Promise<Map<string, string>>}
 */
export const read_start_copy = async state => {
  const html = await read_file(join(state, START_PAGE), 'utf8')
  return new Map(
    read_items(html, 'file').map(({ path, version }) => [path, version])
  )
}
