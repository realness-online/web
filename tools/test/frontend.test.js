import { access } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const frontend = new URL('../../frontend/', import.meta.url)

test('Realness source belongs to the product frontend without a nested Git repository', async () => {
  for (const path of [
    'src/App.vue',
    'src/router.js',
    'src/views/SignOn.vue',
    'src/components/profile/as-form-mobile.vue',
    'src/components/profile/as-form-name.vue',
    'src/persistence/store.js',
    'src/style/aspect-ratio.css',
    'tests/use/sign-on.spec.js',
    'tracer/Cargo.toml'
  ]) await access(new URL(path, frontend))
  await assert.rejects(access(new URL('.git', frontend)), { code: 'ENOENT' })
})
