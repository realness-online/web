import assert from 'node:assert/strict'
import { randomUUID as random_uuid, createHash as create_hash } from 'node:crypto'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  renameSync as rename_sync,
  unlinkSync as unlink_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'
import { assert_session_closed } from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-compaction.js'
import {
  compress_session_chunk,
  read_session_gzip
} from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import {
  entryToHtmlLine as entry_to_html_line,
  sessionHtmlToEntries as session_html_to_entries
} from '../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'

import { prepare_session_state, rewrite_session_state } from './session-state.js'

const stringify_entry = entry =>
  JSON.stringify(entry, (_, value) => (Object.is(value, -0) ? JSON.rawJSON('-0') : value))

const hash = bytes => create_hash('sha256').update(bytes).digest('hex')
const json_entries = bytes =>
  bytes
    .toString('utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
const walk = root =>
  readdir_sync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : []
  })
const journal = (path, manifest) => {
  const temporary = `${path}.writing-${random_uuid()}`
  write_file_sync(temporary, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600, flush: true })
  rename_sync(temporary, path)
}
const closed = paths => {
  for (const path of paths) {
    if (
      process.env.PI_SESSION_FILE &&
      [resolve(path), resolve(path.replace(/\.html\.gz$/, '.jsonl'))].includes(resolve(process.env.PI_SESSION_FILE))
    )
      throw new Error('Cannot migrate the current session')
    assert_session_closed(path)
  }
}
const point_headers = (entries, mapping) =>
  entries.map(entry =>
    entry.type === 'session' && mapping.has(entry.parentSession)
      ? { ...entry, parentSession: mapping.get(entry.parentSession) }
      : entry
  )

/** Trial-only conversion. Originals are archived before a verified compressed file replaces them. */
export const convert_history = ({ root: given_root, backup: given_backup, state, deferred }) => {
  const root = resolve(given_root)
  const backup = resolve(given_backup)
  if (backup === root || backup.startsWith(root + sep)) throw new Error('Backups must be outside session discovery')
  if (exists_sync(backup)) throw new Error('Backup destination already exists')
  const paths = walk(root).filter(path => path.endsWith('.jsonl'))
  closed(paths)
  const prepared = prepare_session_state({ state, deferred })
  const mapping = new Map(paths.map(path => [path, path.replace(/\.jsonl$/, '.html.gz')]))
  const planned = paths.map(source => {
    const target = mapping.get(source)
    if (exists_sync(target)) throw new Error(`Target already exists: ${target}`)
    const bytes = read_file_sync(source)
    const original = json_entries(bytes)
    if (original[0]?.type !== 'session' || typeof original[0].id !== 'string')
      throw new Error(`Session lacks a valid header: ${source}`)
    const entries = point_headers(original, mapping)
    const html = entries.map(entry => entry_to_html_line(entry, original[0].id)).join('\n') + '\n'
    const packed = compress_session_chunk(html)
    assert.deepEqual(session_html_to_entries(read_session_gzip(packed).text), entries)
    return { source, target, bytes, packed, name: relative(root, source), sha: hash(bytes) }
  })
  mkdir_sync(backup, { recursive: true, mode: 0o700 })
  const manifest_path = join(backup, 'manifest.json')
  const manifest = {
    version: 1,
    root,
    backup,
    state_root: state,
    deferred_path: deferred,
    state: 'converting',
    files: planned.map(({ name, sha }) => ({ name, sha, state: 'planned' }))
  }
  journal(manifest_path, manifest)
  for (const [index, item] of planned.entries()) {
    closed([item.source])
    assert.equal(hash(read_file_sync(item.source)), item.sha, 'Source changed during conversion')
    const original = join(backup, 'originals', item.name)
    mkdir_sync(dirname(original), { recursive: true })
    write_file_sync(original, item.bytes, { flag: 'wx', mode: 0o600, flush: true })
    assert.ok(read_file_sync(original).equals(item.bytes), 'Original backup differs')
    write_file_sync(item.target, item.packed, { flag: 'wx', mode: 0o600, flush: true })
    assert.deepEqual(read_session_gzip(read_file_sync(item.target)).text, read_session_gzip(item.packed).text)
    manifest.files[index].state = 'target-written'
    journal(manifest_path, manifest)
    assert.equal(hash(read_file_sync(item.source)), item.sha, 'Source changed before retirement')
    unlink_sync(item.source)
    manifest.files[index].state = 'converted'
    journal(manifest_path, manifest)
  }
  manifest.references = rewrite_session_state({
    root,
    state,
    deferred,
    mapping,
    archive: join(backup, 'state-originals'),
    prepared
  })
  manifest.state = 'converted'
  journal(manifest_path, manifest)
  return { manifest: manifest_path, files: planned.length }
}

/** Preserve new entries and new sessions; unchanged originals return byte-for-byte. */
export const rollback_history = manifest_path => {
  const manifest = JSON.parse(read_file_sync(manifest_path, 'utf8'))
  if (manifest.version !== 1) throw new Error('Unknown migration manifest version')
  const files = walk(manifest.root).filter(path => path.endsWith('.html.gz'))
  closed(files)
  const prepared = prepare_session_state({ state: manifest.state_root, deferred: manifest.deferred_path })
  const mapping = new Map([
    ...manifest.files.map(file => {
      const source = join(manifest.root, file.name)
      return [source.replace(/\.jsonl$/, '.html.gz'), source]
    }),
    ...(manifest.rollback_files ?? []).map(file => [file.target, file.source]),
    ...files.map(path => [path, path.replace(/\.html\.gz$/, '.jsonl')])
  ])
  const originals = new Map(manifest.files.map(file => [join(manifest.root, file.name), file]))
  const planned = files.map(target => {
    const source = mapping.get(target)
    const packed = read_file_sync(target)
    const decoded = read_session_gzip(packed)
    if (decoded.incomplete_bytes) throw new Error(`Rollback requires a complete tail: ${target}`)
    const entries = point_headers(session_html_to_entries(decoded.text), mapping)
    if (entries[0]?.type !== 'session' || typeof entries[0].id !== 'string')
      throw new Error(`Session lacks a valid header: ${target}`)
    const original = originals.get(source)
    let bytes = Buffer.from(entries.map(stringify_entry).join('\n') + '\n')
    if (original) {
      const archived = read_file_sync(join(manifest.backup, 'originals', original.name))
      assert.equal(hash(archived), original.sha, 'Original backup changed')
      if (is_deep_strict_equal(json_entries(archived), entries)) bytes = archived
    }
    if (exists_sync(source))
      assert.ok(read_file_sync(source).equals(bytes), 'Rollback would overwrite a different JSONL session')
    return { target, source, packed, bytes }
  })
  const archive = join(manifest.backup, `compressed-${random_uuid()}`)
  mkdir_sync(archive, { recursive: true, mode: 0o700 })
  manifest.state = 'rolling-back'
  manifest.rollback_files = [...mapping].map(([target, source]) => ({ target, source }))
  journal(manifest_path, manifest)
  for (const item of planned) {
    closed([item.target])
    assert.ok(read_file_sync(item.target).equals(item.packed), 'Session changed during rollback')
    const saved = join(archive, relative(manifest.root, item.target))
    mkdir_sync(dirname(saved), { recursive: true })
    write_file_sync(saved, item.packed, { flag: 'wx', mode: 0o600, flush: true })
    assert.ok(read_file_sync(saved).equals(item.packed), 'Rollback archive differs')
    if (!exists_sync(item.source)) write_file_sync(item.source, item.bytes, { flag: 'wx', mode: 0o600, flush: true })
    assert.deepEqual(json_entries(read_file_sync(item.source)), json_entries(item.bytes))
    unlink_sync(item.target)
  }
  manifest.rollback_references = rewrite_session_state({
    root: manifest.root,
    state: manifest.state_root,
    deferred: manifest.deferred_path,
    mapping,
    archive: join(archive, 'state'),
    originals: join(manifest.backup, 'state-originals'),
    prepared
  })
  manifest.state = 'rolled-back'
  journal(manifest_path, manifest)
  return { files: planned.length, archive }
}
