import { spawnSync as spawn_sync } from 'node:child_process'
import {
  closeSync as close_sync,
  mkdirSync as mkdir_sync,
  openSync as open_sync
} from 'node:fs'
import { join } from 'node:path'
import { project_root } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'
import { run_entry } from './lib/entry.js'

/**
 * The command line for each report mode.
 * @param {string} reports
 */
export const report_commands = reports => {
  const coverage = join(reports, 'coverage/coverage-final.json')
  const fallow = join(reports, 'fallow-report.json')
  const scripts = join(project_root, '../../.pi/skills/test-coverage/scripts')
  return {
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
}

/**
 * Run one report; fallow output is saved to a file, the rest print.
 * @param {object} [options]
 * @param {string} [options.mode]
 * @param {string} [options.reports]
 * @param {typeof spawn_sync} [options.run]
 * @returns {number} exit status
 */
export const main = ({
  mode = process.argv[2],
  reports = out_path('frontend'),
  run = spawn_sync
} = {}) => {
  const commands = report_commands(reports)
  if (!Object.hasOwn(commands, mode)) throw new Error(`Unknown report: ${mode}`)
  mkdir_sync(reports, { recursive: true })
  const output =
    mode === 'fallow'
      ? open_sync(join(reports, 'fallow-report.json'), 'w')
      : 'inherit'
  const [command, ...args] = commands[mode]
  const result = run(command, args, {
    cwd: project_root,
    stdio: ['ignore', output, 'inherit']
  })
  if (typeof output === 'number') close_sync(output)
  if (result.error) throw result.error
  return result.status ?? 1
}

await run_entry(import.meta.url, () => process.exit(main()))
