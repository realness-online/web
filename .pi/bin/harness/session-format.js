#!/usr/bin/env node
import { lstatSync as lstat_sync, readFileSync as read_file_sync } from 'node:fs'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { isAbsolute as is_absolute, join, relative, resolve } from 'node:path'
import { convert_history, rollback_history } from '../lib/session-migration.js'
import { runtime_sessions } from './session-location.js'

const [action, path, backup, state, deferred, ...extra] = process.argv.slice(2)
const artifacts = resolve(import.meta.dirname, '../../../artifacts')
const trial_path = path => {
  if (!path) throw new Error('A trial path is required')
  const resolved = resolve(path)
  const name = relative(artifacts, resolved)
  if (!name || name.startsWith('..') || is_absolute(name)) throw new Error('Trials must stay inside the harness artifacts folder')
  let target = artifacts
  for (const part of name.split('/')) {
    target = resolve(target, part)
    if (lstat_sync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Trial paths must not contain symlinks')
  }
  return resolved
}
const agent = resolve(import.meta.dirname, '../../../.pi/agent')
const backups = join(agent, 'session-backups')
/** Refuse to touch live history while any pi process could be appending to it. */
const no_live_pi = () => {
  const live = exec_file_sync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' }).split('\n')
    .map(line => line.trim().split(/\s+/)).filter(([, comm]) => comm && comm.split('/').pop() === 'pi').map(([pid]) => pid)
  if (live.length) throw new Error(`pi is still running (pid ${live.join(', ')}). Close every pi session first.`)
}
const backup_path = path => {
  const resolved = resolve(path)
  const name = relative(backups, resolved)
  if (!name || name.startsWith('..') || is_absolute(name)) throw new Error(`Manifest must be inside ${backups}`)
  return resolved
}
if (extra.length) throw new Error('Too many arguments')
if (action === 'convert' && !path) {
  no_live_pi()
  const backup = join(backups, new Date().toISOString().replace(/[:.]/g, '-'))
  const deferred_file = join(agent, 'deferred.json')
  const result = convert_history({ root: runtime_sessions(resolve(agent, '../..')), backup, state: join(agent, 'state'), deferred: lstat_sync(deferred_file, { throwIfNoEntry: false }) ? deferred_file : undefined })
  process.stdout.write(`${JSON.stringify(result)}\nTo go back to JSONL: node .pi/bin/harness/session-format.js rollback ${result.manifest}\n`)
} else if (action === 'rollback' && path && !backup) {
  no_live_pi()
  const manifest = backup_path(path)
  backup_path(JSON.parse(read_file_sync(manifest, 'utf8')).backup)
  process.stdout.write(`${JSON.stringify(rollback_history(manifest))}\n`)
} else if (action === 'trial-convert') {
  process.stdout.write(`${JSON.stringify(convert_history({ root: trial_path(path), backup: trial_path(backup), state: state && trial_path(state), deferred: deferred && trial_path(deferred) }))}\n`)
} else if (action === 'trial-rollback' && !backup && !state && !deferred) {
  const manifest = trial_path(path)
  const stored = JSON.parse(read_file_sync(manifest, 'utf8'))
  trial_path(stored.root)
  trial_path(stored.backup)
  if (stored.state_root) trial_path(stored.state_root)
  if (stored.deferred_path) trial_path(stored.deferred_path)
  for (const file of stored.files) {
    trial_path(join(stored.root, file.name))
    trial_path(join(stored.backup, 'originals', file.name))
  }
  for (const file of stored.rollback_files ?? []) {
    trial_path(file.source)
    trial_path(file.target)
  }
  process.stdout.write(`${JSON.stringify(rollback_history(manifest))}\n`)
} else throw new Error('Usage: session-format.js convert | rollback <manifest.json> | trial-convert <copied-history> <backup-folder> [copied-state] [copied-deferred.json] | trial-rollback <manifest.json>')
