import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  lstatSync as lstat_sync,
  readdirSync as readdir_sync,
  renameSync as rename_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { randomUUID as random_uuid } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'

/** Accept only known session paths; unrelated strings and sync baseline keys stay unchanged. */
const aliases = (root, mapping, target_root = root, harness) =>
  new Map(
    [...mapping].flatMap(([from, to]) => {
      const old_name = relative(root, from).split('\\').join('/')
      const new_name = relative(target_root, to).split('\\').join('/')
      const harness_paths = harness
        ? [[relative(harness, from).split('\\').join('/'), relative(harness, to).split('\\').join('/')]]
        : [[`.pi/agent/sessions/${old_name}`, `.pi/agent/sessions/${new_name}`]]
      return [[from, to], [old_name, new_name], ...harness_paths]
    })
  )
const rewrite = (value, kind, mapping) => {
  if (kind === 'light')
    return value.skipped == null ? value : { ...value, skipped: value.skipped.map(path => mapping.get(path) ?? path) }
  if (kind !== 'deferred') return value
  return Object.fromEntries(
    Object.entries(value).map(([path, pending]) => [
      path,
      {
        ...pending,
        calls: pending.calls.map(call => ({ ...call, session: mapping.get(call.session) ?? call.session }))
      }
    ])
  )
}
const plain_path = path => {
  if (lstat_sync(path, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error(`State path must not be a symlink: ${path}`)
}

/** Validate known records before retiring any history file. */
export const prepare_session_state = ({ state, deferred }) => {
  const records = []
  const edit_path = state && join(state, 'edits.db')
  if (state) plain_path(state)
  if (edit_path) plain_path(edit_path)
  if (edit_path && exists_sync(edit_path)) {
    const db = new DatabaseSync(edit_path, { readOnly: true })
    try {
      db.prepare('SELECT session FROM edit LIMIT 0').all()
    } finally {
      db.close()
    }
  }
  if (state && exists_sync(state)) {
    if (exists_sync(join(state, 'light.json')))
      records.push({ path: join(state, 'light.json'), name: 'light.json', kind: 'light' })
    const sync = join(state, 'sync')
    plain_path(sync)
    if (exists_sync(sync)) {
      for (const name of readdir_sync(sync).filter(name => name.endsWith('.json')))
        records.push({ path: join(sync, name), name: `sync/${name}`, kind: 'sync' })
    }
  }
  if (deferred && exists_sync(deferred)) records.push({ path: deferred, name: 'deferred.json', kind: 'deferred' })
  return {
    edit_path,
    records: records.map(record => {
      plain_path(record.path)
      const bytes = read_file_sync(record.path)
      const value = JSON.parse(bytes.toString('utf8'))
      rewrite(value, record.kind, new Map())
      return { ...record, bytes, value }
    })
  }
}
const save = (path, bytes) => {
  mkdir_sync(dirname(path), { recursive: true, mode: 0o700 })
  if (exists_sync(path)) return
  write_file_sync(path, bytes, { flag: 'wx', mode: 0o600, flush: true })
  if (!read_file_sync(path).equals(bytes)) throw new Error(`State backup differs: ${path}`)
}

/** Snapshot WAL-aware edit rows, then rewrite only references. Later rows survive reverse migration. */
export const rewrite_session_state = ({
  root,
  target_root,
  harness,
  state,
  deferred,
  mapping,
  archive,
  originals,
  prepared = prepare_session_state({ state, deferred })
}) => {
  const references = aliases(root, mapping, target_root, harness)
  mkdir_sync(archive, { recursive: true, mode: 0o700 })
  let edits = 0
  const { edit_path, records } = prepared
  if (edit_path && exists_sync(edit_path)) {
    const db = new DatabaseSync(edit_path)
    try {
      const saved = join(archive, 'edits.db')
      if (!exists_sync(saved)) db.prepare('VACUUM INTO ?').run(saved)
      db.exec('BEGIN IMMEDIATE')
      try {
        const sessions = db.prepare('SELECT DISTINCT session FROM edit').all()
        const update = db.prepare('UPDATE edit SET session = ? WHERE session = ?')
        for (const { session } of sessions) {
          const target = references.get(session)
          if (target && target !== session) edits += Number(update.run(target, session).changes)
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    } finally {
      db.close()
    }
  }
  let changed = 0
  for (const { path, name, kind, bytes, value: original } of records) {
    const updated = rewrite(original, kind, references)
    save(join(archive, name), bytes)
    if (is_deep_strict_equal(original, updated)) continue
    let output = Buffer.from(
      `${JSON.stringify(updated, (_, value) => (Object.is(value, -0) ? JSON.rawJSON('-0') : value), 2)}\n`
    )
    const prior = originals && join(originals, name)
    if (prior && exists_sync(prior)) {
      const saved = read_file_sync(prior)
      if (is_deep_strict_equal(JSON.parse(saved.toString('utf8')), updated)) output = saved
    }
    if (!read_file_sync(path).equals(bytes)) throw new Error(`State changed during migration: ${path}`)
    const temporary = `${path}.session-format-writing-${random_uuid()}`
    write_file_sync(temporary, output, { flag: 'wx', mode: 0o600, flush: true })
    rename_sync(temporary, path)
    changed += 1
  }
  return { edits, records: changed, archive }
}
