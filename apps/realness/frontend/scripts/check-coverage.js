import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'

const report = JSON.parse(
  read_file_sync(
    process.argv[2] || out_path('frontend', 'coverage', 'coverage-final.json'),
    'utf8'
  )
)
const { app } = product_paths()
const measured = Object.entries(report).filter(
  ([file, coverage]) =>
    resolve(file).startsWith(app + sep) &&
    Object.keys(coverage.s || {}).length > 0
)
assert.ok(measured.length > 0, 'Coverage must measure app source files')
process.stdout.write(`Coverage measured ${measured.length} app source files\n`)
