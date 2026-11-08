#!/usr/bin/env node
/**
 * Run the scouts in the vault, on the Mac, before they live in the halo.
 *
 *     npm run scout
 *     npm run scout -- realness
 *     npm run scout -- Scouts/SMS --dry-run
 *
 * A scout is a `scout.html` in a plan folder. With no name, every active scout
 * runs. The report, the finds page, and the run folder all land in the vault.
 * The pi session has its own path, kept out of the run folder.
 */
import { spawn } from 'node:child_process'
import { createWriteStream as create_write_stream } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import { run_scout } from '../src/scouts/run.js'
import { find_scout, scout_pages } from '../src/scouts/scout.js'
import { person } from '../src/harness/settings.js'
import { run_entry } from './lib/entry.js'

const here = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
const vault_dir = resolve(here, 'vault')
/** An ISO date is the first ten characters of the full stamp. */
const DATE_LENGTH = 10
/** A scout page always sets its own deadline; this is only a fallback. */
const DEFAULT_MINUTES = 30
/** The repo's own pi launcher; npm's PATH does not hold a global `pi`. */
const PI = resolve(here, '.pi/bin/pi')
/** The shell's code for a command that could not start. */
const NOT_STARTED = 127

/**
 * Pi in print mode, its log beside the run.
 * @param {string} brief
 * @param {string} run_dir
 * @param {number} [minutes]
 * @param {string} [command] the pi to start, for a test that starts none
 */
export const spawn_pi = async (brief, run_dir, minutes, command = PI) => {
  const log = create_write_stream(resolve(run_dir, 'pi.log'))
  const child = spawn(command, ['-p', brief], {
    cwd: here,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  const timer = setTimeout(
    () => child.kill('SIGTERM'),
    (minutes || DEFAULT_MINUTES) * MS_PER_MINUTE
  )
  const code = await new Promise(done => {
    child.on('error', error => {
      log.write(`${command} did not start: ${error.message}\n`)
      done(NOT_STARTED)
    })
    child.on('close', value => done(value))
  })
  clearTimeout(timer)
  if (code !== 0)
    process.stderr.write(
      `pi exited ${code}; its log is at ${resolve(run_dir, 'pi.log')}\n`
    )
  return code
}

/** Every active scout, or the one named on the command line. */
const chosen_scouts = ({ args, vault }) => {
  const requested = args.find(arg => !arg.startsWith('--'))
  const pages = scout_pages(vault)
  const chosen = requested
    ? [find_scout(pages, requested)]
    : pages.filter(page => page.status === 'active')
  if (!chosen.length)
    throw new Error(
      `no active scout: write a scout.html in a plan folder under ${vault}/Projects`
    )
  return chosen
}

/**
 * @param {object} [options]
 * @param {string[]} [options.args]
 * @param {string} [options.vault] the vault the scouts live in
 * @param {(brief: string, run_dir: string, minutes: number) => Promise<number | void>} [options.spawn_pi]
 * @param {{ write: (line: string) => void }} [options.out]
 * @param {{ write: (line: string) => void }} [options.err]
 */
export const main = async ({
  args = process.argv.slice(2),
  vault = vault_dir,
  spawn_pi: spawn = spawn_pi,
  out = process.stdout,
  err = process.stderr
} = {}) => {
  const dry_run = args.includes('--dry-run')
  const chosen = chosen_scouts({ args, vault })
  for (const scout of chosen) {
    const result = await run_scout({
      scout: scout.path,
      vault_dir: vault,
      date: new Date().toISOString().slice(0, DATE_LENGTH),
      spawn_pi: spawn,
      person: person(here),
      dry_run
    }).catch(error => {
      err.write(`${error.message}\n`)
      process.exitCode = 1
      return null
    })
    if (result && dry_run) out.write(`${result.brief}\n`)
    else if (result)
      out.write(
        `${scout.path}: ${result.fresh.length} new, ${result.repeats.length} seen, ${result.problems.length} bad records\n${result.path}\n${result.runs}\n`
      )
  }
}

await run_entry(import.meta.url, main)
