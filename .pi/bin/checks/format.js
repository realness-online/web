#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { readFileSync as read_file_sync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const harness = join(dirname(file_url_to_path(import.meta.url)), '../..')
const vp = join(harness, '../apps/realness/node_modules/.bin/vp')
const FIX = 'node .pi/bin/checks/format.js --fix'

/** @param {string[]} args @param {string} [input] */
const run_vp = (args, input) => spawn_sync(vp, args, { cwd: harness, encoding: 'utf8', input })

/** Files under `.pi` that `vp fmt` would change. */
export const unformatted = () =>
  run_vp(['fmt', '--list-different'])
    .stdout.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('Finished') && !line.includes(' '))

/** A unified diff from the file as written to the file as `vp fmt` writes it. */
export const diff_of = path => {
  const text = read_file_sync(join(harness, path), 'utf8')
  const formatted = run_vp(['fmt', '--stdin-filepath', path], text).stdout
  return spawn_sync(
    'diff',
    ['-u', '--label', `.pi/${path}`, '--label', `.pi/${path} (formatted)`, join(harness, path), '-'],
    {
      encoding: 'utf8',
      input: formatted
    }
  ).stdout
}

const MAX_LINES = 20

/** @param {string} diff */
const clip = diff => {
  const lines = diff.split('\n')
  if (lines.length <= MAX_LINES) return diff
  return `${lines.slice(0, MAX_LINES).join('\n')}\n... ${lines.length - MAX_LINES} more lines\n`
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const files = unformatted()
  if (process.argv.includes('--fix')) {
    if (files.length) run_vp(['fmt', ...files])
    process.stdout.write(`formatted ${files.length} files\n`)
  } else if (files.length) {
    for (const path of files) process.stderr.write(clip(diff_of(path)))
    process.stderr.write(
      `\n${files.length} files need formatting:\n${files.map(path => `.pi/${path}`).join('\n')}\nRun: ${FIX}\n`
    )
    process.exit(1)
  } else process.stdout.write('.pi is formatted\n')
}
