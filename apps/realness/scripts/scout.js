#!/usr/bin/env node
/**
 * Print the brief a scout would run, for one scout or every active one.
 *
 *     node scripts/scout.js
 *     node scripts/scout.js realness
 *
 * The scouts run in the halo, on their own timer. This prints the brief and
 * writes nothing, which is what a Mac runner is for now.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { ISO_DATE } from '#root/lib/units.js'
import { run_scout } from '../src/scouts/run.js'
import { find_scout, scout_pages } from '../src/scouts/scout.js'
import { run_entry } from './lib/entry.js'

const here = resolve(dirname(file_url_to_path(import.meta.url)), '../../..')
const vault_dir = resolve(here, 'vault')

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
 * @param {{ write: (line: string) => void }} [options.out]
 * @param {{ write: (line: string) => void }} [options.err]
 */
export const main = async ({
  args = process.argv.slice(2),
  vault = vault_dir,
  out = process.stdout,
  err = process.stderr
} = {}) => {
  for (const scout of chosen_scouts({ args, vault })) {
    const result = await run_scout({
      scout: scout.path,
      vault_dir: vault,
      date: new Date().toISOString().slice(0, ISO_DATE),
      dry_run: true
    }).catch(error => {
      err.write(`${error.message}\n`)
      process.exitCode = 1
      return null
    })
    if (result) out.write(`${result.brief}\n`)
  }
}

await run_entry(import.meta.url, main)
