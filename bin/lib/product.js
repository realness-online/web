import { createRequire as create_require } from 'node:module'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { resolve } from 'node:path'
import {
  fileURLToPath as file_url_to_path,
  pathToFileURL as path_to_file_url
} from 'node:url'

const home = file_url_to_path(new URL('../../', import.meta.url))

/** Keep explicit and actor locations stable while the checkout changes names. */
export const product_manifest = (root = home) => {
  if (exists_sync('/usr/local/lib/realness/package.json'))
    return '/usr/local/lib/realness/package.json'
  return resolve(root, 'apps/realness/package.json')
}

/** Resolve a public product export without depending on its source layout. */
export const product_entry = (name, root = home) => {
  const manifest = product_manifest(root)
  const { exports: entries } = JSON.parse(read_file_sync(manifest, 'utf8'))
  const entry = entries?.[`./${name}`]
  const target = typeof entry === 'string' ? entry : entry?.node
  if (typeof target !== 'string' || !target.startsWith('./'))
    throw Object.assign(new Error(`Product export is unavailable: ${name}`), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
    })
  return create_require(manifest).resolve(target)
}

/** Import a public product export from the checkout or installed actor runtime. */
export const product_import = name =>
  import(path_to_file_url(product_entry(name)))
