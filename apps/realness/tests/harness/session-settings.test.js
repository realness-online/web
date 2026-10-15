import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdirSync as mkdir_sync,
  writeFileSync as write_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { resolve, join } from 'node:path'
import * as settings from '#root/src/harness/settings.js'

const scratch = resolve(
  import.meta.dirname,
  '../../../../artifacts/realness/session-settings'
)

test('session location defaults to the vault and accepts a vault override', () => {
  rm_sync(scratch, { recursive: true, force: true })
  mkdir_sync(scratch, { recursive: true })
  try {
    assert.equal(settings.sessions_path(scratch), 'vault/Sessions')
    write_file_sync(
      join(scratch, 'package.json'),
      JSON.stringify({ realness: {} })
    )
    assert.equal(settings.sessions_path(scratch), 'vault/Sessions')
    write_file_sync(
      join(scratch, 'package.json'),
      JSON.stringify({ realness: { sessions: 'vault/Private/Sessions' } })
    )
    assert.equal(settings.sessions_path(scratch), 'vault/Private/Sessions')
    for (const sessions of [
      '',
      '/vault/Sessions',
      'outside/Sessions',
      'vault',
      'vault/../Sessions',
      'vault/./Sessions',
      'vault//Sessions',
      'vault\\Sessions',
      null,
      2
    ]) {
      write_file_sync(
        join(scratch, 'package.json'),
        JSON.stringify({ realness: { sessions } })
      )
      assert.throws(() => settings.sessions_path(scratch), /realness.sessions/)
    }
    write_file_sync(join(scratch, 'package.json'), '{')
    assert.throws(() => settings.sessions_path(scratch), SyntaxError)
  } finally {
    rm_sync(scratch, { recursive: true, force: true })
  }
})
