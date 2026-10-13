import assert from 'node:assert/strict'
import { existsSync as exists_sync, lstatSync as lstat_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, renameSync as rename_sync, writeFileSync as write_file_sync } from 'node:fs'
import { randomUUID as random_uuid } from 'node:crypto'
import { dirname, isAbsolute as is_absolute, join, relative, resolve } from 'node:path'
import { sessions_path, state_path } from '../../apps/realness/src/harness/settings.js'
import { assert_no_live_pi, relocate_history, restore_history } from './session-relocation.js'

const harness_root = resolve(import.meta.dirname, '../..')
const artifacts = join(harness_root, 'artifacts')
const root_check = (root, trial) => {
  root = resolve(root)
  const boundary = trial ? artifacts : harness_root
  const name = relative(boundary, root)
  if (trial ? !name || name.startsWith('..') || is_absolute(name) : root !== harness_root) throw new Error('Cutover must use this harness or an isolated trial inside artifacts')
  let path = boundary
  for (const part of name.split('/').filter(Boolean)) {
    path = join(path, part)
    if (lstat_sync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Cutover paths must not contain symlinks')
  }
  if (!trial) assert_no_live_pi()
  return root
}
const atomic_write = (path, value) => {
  const name = relative(harness_root, path)
  if (name.startsWith('..') || is_absolute(name)) throw new Error('Cutover writes must stay inside the harness')
  let checked = harness_root
  for (const part of name.split('/')) {
    checked = join(checked, part)
    if (lstat_sync(checked, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Cutover paths must not contain symlinks')
  }
  mkdir_sync(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.writing-${random_uuid()}`
  write_file_sync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true })
  rename_sync(temporary, path)
}
const config_path = root => join(root, 'package.json')
const journal_path = root => join(root, '.pi/agent/state/session-location-cutover.json')
const read_config = root => JSON.parse(read_file_sync(config_path(root), 'utf8'))

/** Verify all closed history copies before enabling the vault setting; keep a rollback journal. */
export const migrate_sessions = (root = harness_root, { trial = false } = {}) => {
  root = root_check(root, trial)
  const config_bytes = read_file_sync(config_path(root))
  const config = JSON.parse(config_bytes)
  if (config.brayness?.sessions !== undefined) throw new Error('Vault sessions are already configured; no migration performed')
  const target_name = sessions_path(root)
  const state_name = state_path(root)
  if (!state_name || state_name.startsWith('/') || state_name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid harness state folder')
  const deferred = join(root, '.pi/agent/deferred.json')
  if (exists_sync(join(root, target_name))) throw new Error('Session destination already exists; inspect the previous cutover before retrying')
  const journal = { version: 1, manifest: join(root, target_name, 'location-manifest.json'), target: target_name, previous: null, status: 'planned' }
  atomic_write(journal_path(root), journal)
  const result = relocate_history({ harness: root, source: join(root, '.pi/agent/sessions'), target: join(root, target_name), state: join(root, state_name), deferred: exists_sync(deferred) ? deferred : undefined, live: !trial })
  journal.status = 'copied'
  atomic_write(journal_path(root), journal)
  assert.ok(read_file_sync(config_path(root)).equals(config_bytes), 'Harness settings changed during migration; copies retained, activation refused')
  if (!trial) assert_no_live_pi()
  config.brayness = { ...config.brayness, sessions: target_name }
  atomic_write(config_path(root), config)
  journal.status = 'activated'
  atomic_write(journal_path(root), journal)
  return { ...result, sessions: target_name, rollback: 'node bin/session-relocate.js rollback' }
}

/** Reverse history and references before changing the setting; preserve unrelated configuration edits. */
export const rollback_sessions = (root = harness_root, { trial = false } = {}) => {
  root = root_check(root, trial)
  const journal = JSON.parse(read_file_sync(journal_path(root), 'utf8'))
  if (journal.version !== 1 || journal.previous !== null || journal.target !== 'vault/Sessions' || resolve(journal.manifest) !== join(root, journal.target, 'location-manifest.json')) throw new Error('Invalid session cutover journal')
  const config_bytes = read_file_sync(config_path(root))
  const config = JSON.parse(config_bytes)
  if (config.brayness?.sessions !== undefined && config.brayness.sessions !== journal.target) throw new Error('Session settings changed after cutover; rollback refused')
  const result = restore_history(journal.manifest, { live: !trial })
  assert.ok(read_file_sync(config_path(root)).equals(config_bytes), 'Harness settings changed during rollback; activation unchanged')
  if (!trial) assert_no_live_pi()
  if (config.brayness) delete config.brayness.sessions
  atomic_write(config_path(root), config)
  journal.status = 'restored'
  atomic_write(journal_path(root), journal)
  return { ...result, sessions: '.pi/agent/sessions', originals_retained: true }
}
