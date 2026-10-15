#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync as exists_sync, cpSync as cp_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, renameSync as rename_sync, unlinkSync as unlink_sync, writeFileSync as write_file_sync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { verify_install } from './lib/pi-release.js'

/** Select a tested install without changing history or the previous launcher route. */
export const select_fork = ({ root, install }) => {
  const proof = JSON.parse(read_file_sync(join(install, 'verification.json'), 'utf8'))
  assert.equal(resolve(proof.root), resolve(install))
  for (const key of ['installed_sdk_cli_pass', 'installed_compressed_write_resume', 'installed_reader_pass', 'installed_remember_pass']) assert.equal(proof[key], true, `Missing check: ${key}`)
  assert.ok(exists_sync(join(resolve(install), 'consumer/node_modules/.bin/pi')), 'Installed Pi is missing')
  assert.ok(exists_sync(join(resolve(install), 'consumer/node_modules/.bin/pi-session-read')), 'Installed reader is missing')
  verify_install(join(resolve(install), 'consumer'))
  const state = join(root, '.pi/agent/state')
  const marker = join(state, 'fork-path')
  assert.ok(!exists_sync(marker), 'A fork is already selected; rollback first')
  const managed = join(state, 'pi-forks', basename(resolve(install)))
  mkdir_sync(state, { recursive: true, mode: 0o700 })
  if (!exists_sync(managed)) {
    mkdir_sync(managed, { recursive: true, mode: 0o700 })
    cp_sync(join(install, 'consumer'), join(managed, 'consumer'), { recursive: true, verbatimSymlinks: true })
    if (exists_sync(join(install, 'tarballs'))) cp_sync(join(install, 'tarballs'), join(managed, 'tarballs'), { recursive: true })
    write_file_sync(join(managed, 'verification.json'), JSON.stringify({ ...proof, root: managed, staged_from: resolve(install) }), { mode: 0o600 })
  }
  const pinned = JSON.parse(read_file_sync(join(managed, 'verification.json'), 'utf8'))
  assert.ok(pinned.staged_from === resolve(install) || managed === resolve(install), 'Managed install belongs to another source')
  const binary = join(managed, 'consumer/node_modules/.bin/pi')
  assert.ok(exists_sync(binary), 'Managed Pi is missing')
  assert.ok(exists_sync(join(managed, 'consumer/node_modules/.bin/pi-session-read')), 'Managed reader is missing')
  verify_install(join(managed, 'consumer'))
  const temporary = `${marker}.writing`
  write_file_sync(temporary, `${relative(root, binary)}\n`, { flag: 'wx', mode: 0o600, flush: true })
  rename_sync(temporary, marker)
  return binary
}

/** Restore the original PATH/npx route; history is deliberately unchanged. */
export const rollback_launcher = root => {
  const marker = join(root, '.pi/agent/state/fork-path')
  if (exists_sync(marker)) unlink_sync(marker)
}

if (process.argv[1] && resolve(process.argv[1]) === file_url_to_path(import.meta.url)) {
  const [action, install, ...extra] = process.argv.slice(2)
  const root = resolve(import.meta.dirname, '..')
  if (extra.length) throw new Error('Too many arguments')
  if (action === 'enable' && install) console.log(select_fork({ root, install: resolve(install) }))
  else if (action === 'rollback' && !install) { rollback_launcher(root); console.log('Previous launcher route restored. History unchanged.') }
  else throw new Error('Usage: node bin/pi-fork.js enable <verified-install> | rollback')
}
