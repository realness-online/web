import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  closeSync as close_sync,
  mkdirSync as mkdir_sync,
  openSync as open_sync
} from 'node:fs'
import { join } from 'node:path'
import { project_root } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'

const reports = out_path('frontend')
const coverage = join(reports, 'coverage/coverage-final.json')
const fallow = join(reports, 'fallow-report.json')
const scripts = join(project_root, '../../.pi/skills/test-coverage/scripts')
const commands = {
  fallow: [
    join(project_root, 'node_modules/.bin/fallow'),
    '--format',
    'json',
    '--quiet',
    '--coverage',
    coverage,
    '--coverage-root',
    project_root
  ],
  risk: [
    process.execPath,
    join(scripts, 'prioritize-refactor-risk.js'),
    '--root',
    project_root,
    '--coverage',
    coverage,
    '--fallow',
    fallow
  ],
  coverage: [
    process.execPath,
    join(scripts, 'summarize-coverage.js'),
    '--root',
    project_root,
    '--coverage',
    coverage
  ]
}
const [, , mode] = process.argv
assert.ok(Object.hasOwn(commands, mode), `Unknown report: ${mode}`)
mkdir_sync(reports, { recursive: true })
const output = mode === 'fallow' ? open_sync(fallow, 'w') : 'inherit'
const [command, ...args] = commands[mode]
const result = spawn_sync(command, args, {
  cwd: project_root,
  stdio: ['ignore', output, 'inherit']
})
if (typeof output === 'number') close_sync(output)
if (result.error) throw result.error
process.exit(result.status ?? 1)
