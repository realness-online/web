import { access } from 'node:fs/promises'
import { it } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('../../', import.meta.url)

it('the web app builds from the app root, with its source in src/app and specs in specs/app', async () => {
  for (const path of [
    'index.html',
    'public/icons.svg',
    'src/app/App.vue',
    'src/app/router.js',
    'src/app/views/SignOn.vue',
    'src/app/components/profile/as-form-mobile.vue',
    'src/app/components/profile/as-form-name.vue',
    'src/app/persistence/store.js',
    'src/app/style/aspect-ratio.css',
    'specs/app/use/sign-on.spec.js',
    'tracer/Cargo.toml'
  ])
    await access(new URL(path, root))
  await assert.rejects(access(new URL('.git', root)), { code: 'ENOENT' })
  for (const path of [
    'frontend',
    'tests',
    'src/main.js',
    'src/chat',
    'src/terminal',
    'lib/sign-on/src/browser/flow.js'
  ]) {
    await assert.rejects(access(new URL(path, root)), { code: 'ENOENT' })
  }
  for (const path of [
    'src/app/terminal/terminal.js',
    'src/app/terminal/ghostty-vt.wasm',
    'src/app/utils/stream-records.js',
    'src/sign-on/browser/flow.js'
  ]) {
    await access(new URL(path, root))
  }
})
