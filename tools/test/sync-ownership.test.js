import assert from 'node:assert/strict'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../../', import.meta.url)
const groups = {
  'lib/files/src': ['client', 'edits', 'ignore', 'paths', 'replay', 'skip', 'starter'],
  'lib/harness/src': ['actor', 'harness', 'recover', 'settings', 'turns'],
  'lib/sign-on/src/node': ['recovery-pass']
}

test('shared file and harness code has a home outside the sync service', () => {
  for (const [folder, names] of Object.entries(groups)) {
    for (const name of names) {
      const path = `${folder}/${name}.js`
      assert.ok(exists_sync(new URL(path, root)), `${path} is missing`)
      const old_name = name === 'settings' ? 'harness-settings' : name
      assert.ok(!exists_sync(new URL(`server/sync/src/${old_name}.js`, root)), `${old_name} still belongs to the service`)
    }
  }
})

test('shared file and harness modules do not depend on sync service code', () => {
  for (const [folder, names] of Object.entries(groups)) {
    for (const name of names) {
      const source = read_file_sync(new URL(`${folder}/${name}.js`, root), 'utf8')
      for (const [, specifier] of source.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
        assert.ok(!specifier.includes('server/'), `${folder}/${name}.js imports ${specifier}`)
      }
    }
  }
})
