import assert from 'node:assert/strict'
import { spawnSync as spawn } from 'node:child_process'
import {
  copyFileSync as copy,
  mkdirSync as mkdir,
  mkdtempSync as mkdtemp,
  readFileSync as read_file,
  rmSync as rm,
  writeFileSync as write_file
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'

const script = new URL('../../checks/soundness-check.js', import.meta.url).pathname
const scratch = new URL('../../../../artifacts/realness/h7/', import.meta.url).pathname
const page = `<!doctype html><html><head>
<link rel="stylesheet" href="/palette.css"><link rel="stylesheet" href="/color.css">
<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/main.js"></script>
</head><body><main itemscope itemtype="https://schema.org/WebPage" itemid="/+15550001111/pages/1791571682897">Hello</main></body></html>`

const fixture = t => {
  mkdir(scratch, { recursive: true })
  const root = mkdtemp(join(scratch, 'site-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  write_file(join(root, 'index.html'), page)
  for (const name of ['palette.css', 'color.css'])
    copy(new URL(`../../../../apps/realness/src/app/style/${name}`, import.meta.url), join(root, name))
  write_file(
    join(root, 'manifest.webmanifest'),
    JSON.stringify({
      name: 'Site',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      icons: [
        { src: '192.png', sizes: '192x192', type: 'image/png' },
        { src: '512.png', sizes: '512x512', type: 'image/png' }
      ]
    })
  )
  for (const size of [192, 512])
    copy(new URL(`../fixtures/site-${size}.png`, import.meta.url), join(root, `${size}.png`))
  write_file(join(root, 'main.js'), "import './register.js'\n")
  write_file(join(root, 'register.js'), "navigator.serviceWorker.register('/service.worker.js')\n")
  write_file(join(root, 'service.worker.js'), "self.addEventListener('fetch', () => {})\n")
  return root
}
const run = root => spawn(process.execPath, [script, '--site', root], { encoding: 'utf8' })

it('h7: built site passes structural checks, without claiming offline behavior', t => {
  const root = fixture(t)
  mkdir(join(root, '+15550001111/pages/1791571682897'), { recursive: true })
  write_file(join(root, '+15550001111/pages/1791571682897/index.html'), page)
  const result = run(root)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /offline, updates, and rendered appearance need browser tests/)
})

const controls = [
  ['itemid', root => write_file(join(root, 'index.html'), page.replace(/ itemid="[^"]+"/, ''))],
  ['itemid', root => write_file(join(root, 'index.html'), page.replace('/pages/1791571682897', '/pages/../../secret'))],
  ['itemid', root => write_file(join(root, 'index.html'), page.replace(' itemscope', ''))],
  ['palette', root => write_file(join(root, 'palette.css'), ':root { --water-fill: red }')],
  [
    'light-mode',
    root => write_file(join(root, 'color.css'), '@media (prefers-color-scheme: dark) { :root { --surface: black } }')
  ],
  [
    'dark-mode',
    root => write_file(join(root, 'color.css'), ':root { --surface: var(--chalk); --text: var(--graphite) }')
  ],
  [
    'pwa-manifest',
    root => write_file(join(root, 'index.html'), page.replace('<link rel="manifest" href="/manifest.webmanifest">', ''))
  ],
  ['pwa-manifest', root => write_file(join(root, 'manifest.webmanifest'), '{')],
  ['pwa-icons', root => rm(join(root, '512.png'))],
  ['pwa-registration', root => write_file(join(root, 'register.js'), 'const x = 1')],
  ['pwa-worker', root => rm(join(root, 'service.worker.js'))],
  [
    'palette',
    root => write_file(join(root, 'index.html'), page.replace('/palette.css', 'https://example.org/palette.css'))
  ]
]
for (const [index, [rule, mutate]] of controls.entries()) {
  it(`h7 negative control ${index + 1}: ${rule}`, t => {
    const root = fixture(t)
    mutate(root)
    const result = run(root)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.ok(result.stdout.includes(`  ${rule}  `), result.stdout)
  })
}

it('h7: an empty output folder fails instead of passing vacuously', t => {
  const root = fixture(t)
  rm(join(root, 'index.html'))
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /site-html/)
})

it('h7: worker filename can match an existing build configuration', t => {
  const root = fixture(t)
  write_file(join(root, 'sw.js'), read_file(join(root, 'service.worker.js')))
  rm(join(root, 'service.worker.js'))
  const result = spawn(process.execPath, [script, '--site', root, '--worker', 'sw.js'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
