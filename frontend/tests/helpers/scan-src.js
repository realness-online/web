/**
 * Minimal recursive file walker for tests that need to grep across src/
 * without pulling in a glob dependency.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SRC_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../src')

/**
 * @param {string[]} extensions e.g. ['.vue', '.styl']
 * @returns {{ path: string, text: string }[]} paths are relative to src/
 */
export const scan_src = extensions => {
  const results = []
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!extensions.some(ext => entry.endsWith(ext))) continue
      results.push({
        path: path.relative(SRC_ROOT, full),
        text: readFileSync(full, 'utf8')
      })
    }
  }
  walk(SRC_ROOT)
  return results
}
