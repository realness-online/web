#!/usr/bin/env node
/**
 * The browser bundle's pin. Durable's API changes without notice, so a build
 * names the exact fork commit and adapter commit it was made from, and refuses
 * to run when the checkout no longer matches.
 *
 *   node frontend/durable-lock.js check     exit 1 when the lock and the checkout disagree
 *   node frontend/durable-lock.js write     record the current commits after a good build
 *   node frontend/durable-lock.js show      print the pin
 */
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const HERE = dirname(file_url_to_path(import.meta.url))
const LOCK = join(HERE, 'durable.lock.json')
const FORK = join(HERE, '../../../work/pi')
const ADAPTER = join(HERE, '../../../artifacts/durable/pi-durable-storage-idb')

const git = (cwd, ...args) =>
  exec_file_sync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()

const version_of = (cwd, manifest) =>
  JSON.parse(read_file_sync(join(cwd, manifest), 'utf8')).version

/** What the checkout is right now, or why it cannot be read. */
export const current = ({ fork = FORK, adapter = ADAPTER } = {}) => {
  for (const [name, cwd] of [
    ['fork', fork],
    ['adapter', adapter]
  ]) {
    if (!exists_sync(cwd))
      return { problem: `${name} checkout missing at ${cwd}` }
    if (!exists_sync(join(cwd, '.git')))
      return { problem: `${name} has no independent Git checkout at ${cwd}` }
    if (resolve(git(cwd, 'rev-parse', '--show-toplevel')) !== resolve(cwd))
      return { problem: `${name} Git root does not match ${cwd}` }
  }

  return {
    fork: {
      commit: git(fork, 'rev-parse', '--short=8', 'HEAD'),
      version: version_of(fork, 'packages/durable/package.json')
    },
    adapter: {
      commit: git(adapter, 'rev-parse', '--short=8', 'HEAD'),
      version: version_of(adapter, 'package.json')
    }
  }
}

/** The pin on disk, or null. */
export const locked = () =>
  exists_sync(LOCK) ? JSON.parse(read_file_sync(LOCK, 'utf8')) : null

/**
 * Every way the checkout and the lock disagree, as plain lines.
 * @param {object} pin
 * @param {{ fork: object, adapter: object }} now
 */
export const mismatches = (pin, now) =>
  ['fork', 'adapter'].flatMap(name =>
    ['commit', 'version'].flatMap(field => {
      const pinned = pin?.[name]?.[field]
      const actual = now?.[name]?.[field]
      if (pinned === actual) return []
      return [
        `${name}.${field}: locked ${pinned ?? '(none)'}, checkout ${actual ?? '(none)'}`
      ]
    })
  )

const check = () => {
  const now = current()
  if (now.problem) return fail(now.problem)
  const pin = locked()
  if (!pin)
    return fail(
      'no durable.lock.json; run `durable-lock.js write` after a good build'
    )
  const wrong = mismatches(pin, now)
  if (wrong.length)
    return fail(`durable bundle pin is stale:\n  ${wrong.join('\n  ')}`)
  console.warn(
    `durable bundle matches ${now.fork.commit} and adapter ${now.adapter.commit}`
  )
}

const write = () => {
  const now = current()
  if (now.problem) return fail(now.problem)
  const pin = { ...now, built: new Date().toISOString() }
  write_file_sync(LOCK, `${JSON.stringify(pin, null, 2)}\n`)
  console.warn(`wrote ${LOCK}`)
}

const show = () =>
  console.warn(JSON.stringify(locked() ?? { pin: null }, null, 2))

const fail = message => {
  console.error(message)
  process.exit(1)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === file_url_to_path(import.meta.url)
) {
  const [command] = process.argv.slice(2)
  if (command === 'check') check()
  else if (command === 'write') write()
  else if (command === 'show') show()
  else fail('usage: durable-lock.js check | write | show')
}
