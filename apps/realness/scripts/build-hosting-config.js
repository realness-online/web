import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { resolve } from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'
import { frontend_out, out_root } from '#root/src/settings/output.js'
import { environment_settings } from '#root/src/settings/environments.js'
import { run_entry } from './lib/entry.js'

/**
 * Hosting refuses a release that routes to a service the project lacks.
 * @param {Set<string>} deployed
 */
const routes_to = deployed => rewrite =>
  !rewrite.run || deployed.has(rewrite.run.serviceId)

/**
 * Write Firebase hosting config. A route to Cloud Run takes the environment's
 * region: production's services run in us-west2, development's in us-central1. with absolute paths under the output root.
 * @param {string[]} [argv]
 */
export const main = (argv = process.argv.slice(2)) => {
  const args = [...argv]
  const env_at = args.indexOf('--env')
  const environment = env_at === -1 ? 'development' : args[env_at + 1]
  if (env_at !== -1) args.splice(env_at, 2)
  const [given] = args
  const output_root = given ? resolve(given) : out_root()
  const { services } = environment_settings(environment)
  const deployed = new Set(services?.hosting_routes ?? [])
  const { frontend } = product_paths()
  const config = JSON.parse(
    read_file_sync(resolve(frontend, 'firebase.json'), 'utf8')
  )
  for (const hosting of config.hosting)
    hosting.public =
      hosting.target === 'app'
        ? frontend_out()
        : resolve(frontend, hosting.public)
  config.storage.rules = resolve(frontend, config.storage.rules)
  for (const hosting of config.hosting)
    if (hosting.rewrites)
      hosting.rewrites = hosting.rewrites
        .filter(routes_to(deployed))
        .map(rewrite =>
          rewrite.run && services?.region
            ? { ...rewrite, run: { ...rewrite.run, region: services.region } }
            : rewrite
        )
  mkdir_sync(resolve(output_root, 'frontend'), { recursive: true })
  write_file_sync(
    resolve(output_root, 'frontend', 'firebase.json'),
    `${JSON.stringify(config, null, 2)}\n`
  )
  write_file_sync(
    resolve(output_root, 'frontend', '.firebaserc'),
    read_file_sync(resolve(frontend, '.firebaserc'))
  )
  return config
}

await run_entry(import.meta.url, main)
