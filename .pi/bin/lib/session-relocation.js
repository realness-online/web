import assert from 'node:assert/strict'
import { createHash as create_hash, randomUUID as random_uuid } from 'node:crypto'
import { existsSync as exists_sync, lstatSync as lstat_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, readdirSync as readdir_sync, renameSync as rename_sync, writeFileSync as write_file_sync } from 'node:fs'
import { basename, dirname, join, relative, resolve, isAbsolute as is_absolute, sep } from 'node:path'
import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { assert_session_closed } from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-compaction.js'
import { compress_session_chunk, read_session_gzip } from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import { entryToHtmlLine as entry_to_html_line, sessionHtmlToEntries as session_html_to_entries } from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'
import { prepare_session_state, rewrite_session_state } from './session-state.js'

const harness_root = resolve(import.meta.dirname, '../../..')
const artifacts = join(harness_root, 'artifacts')

/** A live cutover must run outside Pi, after every Pi process has exited. */
export const assert_no_live_pi = () => {
  if (process.env.PI_SESSION_FILE) throw new Error('Close Pi and run this command from a separate terminal')
  const processes = exec_file_sync('ps', ['-axo', 'pid=,comm='], { encoding: 'utf8' }).split('\n')
  const live = processes.map(line => line.trim().split(/\s+/)).filter(([, command]) => command && basename(command) === 'pi')
  if (live.length) throw new Error(`Close all Pi processes first (pid ${live.map(([pid]) => pid).join(', ')})`)
}
const hash = bytes => create_hash('sha256').update(bytes).digest('hex')
const stringify = value => JSON.stringify(value, (_, item) => Object.is(item, -0) ? JSON.rawJSON('-0') : item)
const checked_path = (path, boundary = artifacts) => {
  const resolved = resolve(path)
  const name = relative(boundary, resolved)
  if ((boundary === artifacts && !name) || name.startsWith('..') || is_absolute(name)) throw new Error('Location trials must stay inside artifacts; live paths must stay inside the harness')
  let current = boundary
  for (const part of name.split('/')) {
    current = join(current, part)
    if (lstat_sync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Location trials must not contain symlinks')
  }
  return resolved
}
const trial_path = path => checked_path(path)
const walk = (root, check = trial_path) => readdir_sync(root, { withFileTypes: true }).flatMap(entry => {
  const path = check(join(root, entry.name))
  return entry.isDirectory() ? walk(path, check) : entry.isFile() && /\.(jsonl|html\.gz)$/.test(entry.name) ? [path] : []
})
const closed = path => {
  if (process.env.PI_SESSION_FILE && resolve(process.env.PI_SESSION_FILE) === resolve(path)) throw new Error('Cannot relocate the current session')
  assert_session_closed(path)
}
const decode = (path, bytes) => {
  let entries
  if (path.endsWith('.html.gz')) {
    const decoded = read_session_gzip(bytes)
    if (decoded.incomplete_bytes) throw new Error(`Session has an incomplete tail: ${path}`)
    entries = session_html_to_entries(decoded.text)
  } else entries = bytes.toString('utf8').split('\n').filter(line => line.trim()).map(JSON.parse)
  if (entries[0]?.type !== 'session' || typeof entries[0].id !== 'string' || !is_absolute(entries[0].cwd)) throw new Error(`Session lacks a valid header: ${path}`)
  return entries
}
const encode = (path, entries) => path.endsWith('.html.gz')
  ? compress_session_chunk(entries.map(entry => entry_to_html_line(entry, entries[0].id)).join('\n') + '\n')
  : Buffer.from(entries.map(stringify).join('\n') + '\n')
const repoint = (entries, mapping) => entries.map(entry => entry.type === 'session' && mapping.has(entry.parentSession) ? { ...entry, parentSession: mapping.get(entry.parentSession) } : entry)
const copy = (path, bytes) => {
  mkdir_sync(dirname(path), { recursive: true, mode: 0o700 })
  write_file_sync(path, bytes, { flag: 'wx', mode: 0o600, flush: true })
  assert.ok(read_file_sync(path).equals(bytes), 'Copied history differs')
}
const replace = (path, bytes) => {
  const temporary = `${path}.writing-${random_uuid()}`
  copy(temporary, bytes)
  rename_sync(temporary, path)
}
const validate_state = (state, deferred, check = trial_path) => {
  if (state) check(state)
  if (deferred) check(deferred)
  return prepare_session_state({ state, deferred })
}

/** Isolated location trial only. Flatten discovery; retain originals and leave runtime settings unchanged. */
export const relocate_history = ({ harness, source, target, state, deferred, live = false }) => {
  if (live) assert_no_live_pi()
  const check = live ? path => checked_path(path, harness_root) : trial_path
  harness = check(harness)
  if (live && harness !== harness_root) throw new Error('Live migration must use this harness')
  source = check(source)
  target = check(target)
  if (exists_sync(target)) throw new Error('Session destination already exists')
  if (target.startsWith(source + sep) || source.startsWith(target + sep)) throw new Error('Session locations must not overlap')
  const prepared = validate_state(state, deferred, check)
  const paths = walk(source, check).sort()
  const counts = new Map()
  for (const path of paths) counts.set(basename(path), (counts.get(basename(path)) ?? 0) + 1)
  const reserved = new Set(paths.map(path => basename(path)))
  const mapping = new Map(paths.map(path => {
    const name = basename(path)
    if (counts.get(name) === 1) return [path, join(target, name)]
    const suffix = name.endsWith('.html.gz') ? '.html.gz' : '.jsonl'
    const stem = name.slice(0, -suffix.length)
    const origin = hash(relative(source, path))
    let renamed = `${stem}-${origin}${suffix}`
    let index = 1
    while (reserved.has(renamed)) renamed = `${stem}-${origin}-${index++}${suffix}`
    reserved.add(renamed)
    return [path, join(target, renamed)]
  }))
  const files = [...mapping].map(([path, destination]) => {
    closed(path)
    const bytes = read_file_sync(path)
    const original = decode(path, bytes)
    const entries = repoint(original, mapping)
    const output = is_deep_strict_equal(original, entries) ? bytes : encode(destination, entries)
    assert.deepEqual(decode(destination, output), entries)
    return { name: relative(source, path), target_name: basename(destination), sha: hash(bytes), bytes, output }
  })
  mkdir_sync(target, { recursive: true, mode: 0o700 })
  const manifest = join(target, 'location-manifest.json')
  const stored = { version: 1, harness, source, target, state, deferred, status: 'copying', files: files.map(({ name, target_name, sha }) => ({ name, target_name, sha })) }
  copy(manifest, Buffer.from(stringify(stored) + '\n'))
  for (const file of files) {
    const path = join(source, file.name)
    closed(path)
    assert.equal(hash(read_file_sync(path)), file.sha, 'Original changed during location trial')
    copy(join(target, file.target_name), file.output)
  }
  stored.references = rewrite_session_state({ root: source, target_root: target, harness, state, deferred, mapping, prepared, archive: join(target, 'state-originals') })
  stored.status = 'copied'
  replace(manifest, Buffer.from(stringify(stored) + '\n'))
  return { manifest, files: files.length }
}

/** Restore current trial records and references; changed originals block rollback. Both locations remain. */
export const restore_history = (manifest_path, { live = false } = {}) => {
  if (live) assert_no_live_pi()
  const check = live ? path => checked_path(path, harness_root) : trial_path
  manifest_path = check(manifest_path)
  const manifest = JSON.parse(read_file_sync(manifest_path, 'utf8'))
  if (manifest.version !== 1) throw new Error('Unknown location manifest version')
  const harness = check(manifest.harness)
  if (live && harness !== harness_root) throw new Error('Live rollback must use this harness')
  const source = check(manifest.source)
  const target = check(manifest.target)
  const prepared = validate_state(manifest.state, manifest.deferred, check)
  for (const file of manifest.files) {
    if (file.name.split(/[\\/]/).some(part => !part || part === '.' || part === '..') || basename(file.target_name) !== file.target_name || !/\.(jsonl|html\.gz)$/.test(file.target_name)) throw new Error('Invalid session path in manifest')
  }
  const originals = new Map(manifest.files.map(file => [join(target, file.target_name), file]))
  const paths = walk(target, check)
  const mapping = new Map(manifest.files.map(file => [join(target, file.target_name), check(join(source, file.name))]))
  for (const path of paths) {
    const original = originals.get(path)
    const header = decode(path, read_file_sync(path))[0]
    const project = `--${header.cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`
    mapping.set(path, check(original ? join(source, original.name) : join(source, project, basename(path))))
  }
  const planned = paths.map(path => {
    const destination = mapping.get(path)
    closed(path)
    const bytes = read_file_sync(path)
    const entries = repoint(decode(path, bytes), mapping)
    const existing = exists_sync(destination) && read_file_sync(destination)
    if (existing) closed(destination)
    const original = originals.get(path)
    let output = encode(destination, entries)
    if (existing && is_deep_strict_equal(decode(destination, existing), entries)) output = existing
    if (existing && !existing.equals(output) && hash(existing) !== original?.sha) throw new Error(`Original changed during location trial: ${destination}`)
    assert.deepEqual(decode(destination, output), entries)
    return { path, destination, bytes, output, existing }
  })
  for (const { path, destination, bytes, output, existing } of planned) {
    closed(path)
    assert.ok(read_file_sync(path).equals(bytes), 'Trial session changed during rollback')
    if (existing) {
      closed(destination)
      assert.ok(read_file_sync(destination).equals(existing), 'Original changed during rollback')
      if (existing.equals(output)) continue
      const archive = `${destination}.before-location-rollback`
      if (exists_sync(archive)) assert.ok(read_file_sync(archive).equals(existing), 'Rollback archive collision')
      else copy(archive, existing)
      replace(destination, output)
    } else copy(destination, output)
  }
  manifest.rollback_references = rewrite_session_state({ root: target, target_root: source, harness, state: manifest.state, deferred: manifest.deferred, mapping, prepared, archive: join(target, 'state-rollback'), originals: join(target, 'state-originals') })
  manifest.status = 'restored'
  replace(manifest_path, Buffer.from(stringify(manifest) + '\n'))
  return { files: planned.length }
}
