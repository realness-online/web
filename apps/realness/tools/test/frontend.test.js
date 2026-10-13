import { access } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const frontend = new URL('../../frontend/', import.meta.url)

test('Realness source shares src/app while frontend retains its platform files', async () => {
  for (const path of [
    '../src/app/App.vue',
    '../src/app/router.js',
    '../src/app/views/SignOn.vue',
    '../src/app/components/profile/as-form-mobile.vue',
    '../src/app/components/profile/as-form-name.vue',
    '../src/app/persistence/store.js',
    '../src/app/style/aspect-ratio.css',
    'tests/use/sign-on.spec.js',
    'tracer/Cargo.toml'
  ]) await access(new URL(path, frontend))
  await assert.rejects(access(new URL('.git', frontend)), { code: 'ENOENT' })
  for (const path of ['src/main.js', 'terminal/src/main.js', 'chat/main.js', '../lib/sign-on/src/browser/flow.js']) {
    await assert.rejects(access(new URL(path, frontend)), { code: 'ENOENT' })
  }
  for (const path of ['../src/terminal/main.js', '../src/chat/main.js', '../src/sign-on/browser/flow.js']) {
    await access(new URL(path, frontend))
  }
})
