import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'

/**
 * Fail unless the coverage report measured app source files.
 * @param {string} [file]
 */
export const main = (
  file = process.argv[2] ||
    out_path('frontend', 'coverage', 'coverage-final.json')
) => {
  const report = JSON.parse(read_file_sync(file, 'utf8'))
  const { app } = product_paths()
  const measured = Object.entries(report).filter(
    ([name, coverage]) =>
      resolve(name).startsWith(app + sep) &&
      Object.keys(coverage.s || {}).length > 0
  )
  assert.ok(measured.length > 0, 'Coverage must measure app source files')
  process.stdout.write(
    `Coverage measured ${measured.length} app source files\n`
  )
  return measured.length
}

await run_entry(import.meta.url, main)
