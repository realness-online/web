import { join, resolve } from 'node:path'
import { pathToFileURL as path_to_file_url } from 'node:url'
import { runtime_sessions_path } from '../lib/harness-settings.js'

/** Enable the vault location only after an explicit harness setting. */
export const runtime_sessions = root => join(root, runtime_sessions_path(root))

if (process.argv[1] && import.meta.url === path_to_file_url(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2])
  const path = runtime_sessions_path(root)
  process.stdout.write(path === '.pi/agent/sessions' ? '' : join(root, path) + '\n')
}
