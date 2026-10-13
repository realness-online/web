import { createRequire as create_require } from 'node:module'
import { existsSync as exists_sync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath as file_url_to_path, pathToFileURL as path_to_file_url } from 'node:url'

const home = file_url_to_path(new URL('../../', import.meta.url))

/** Keep explicit and actor locations stable while the checkout changes names. */
export const product_manifest = (root = home) => {
  if (process.env.BRAYNESS_PRODUCT) return process.env.BRAYNESS_PRODUCT
  if (process.env.BRAYNESS_ACTOR === '1' || process.env.PROFILE === 'actor') return '/usr/local/lib/brayness/package.json'
  const realness = resolve(root, 'apps/realness/package.json')
  return exists_sync(realness) ? realness : resolve(root, 'apps/brayness/package.json')
}

/** Resolve a public product export without depending on its source layout. */
export const product_entry = (name, root = home) => create_require(product_manifest(root)).resolve(`brayness/${name}`)

/** Import a public product export from the checkout or installed actor runtime. */
export const product_import = name => import(path_to_file_url(product_entry(name)))
