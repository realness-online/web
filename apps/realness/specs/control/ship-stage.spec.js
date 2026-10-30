import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  readFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readdirSync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import {
  HOME_ONLY,
  ROOT,
  STARTER,
  proxy_for,
  ship_stage,
  ships,
  starter_manifest
} from '../../tools/control/scripts/ship-stage.js'
import { out_path } from '#root/lib/output.js'
import { development_settings } from '#root/src/settings/environments.js'

const project = new URL('../../', import.meta.url).pathname
const ship = out_path('ship')
const proxy_url = 'http://127.0.0.1:18788'

const pi_scratch = join(project, '../../artifacts/realness-product')
mkdirSync(pi_scratch, { recursive: true })
const fake_pi = mkdtempSync(join(pi_scratch, 'pi-path-'))
writeFileSync(join(fake_pi, 'pi'), '#!/bin/sh\necho 1.2.3\n', { mode: 0o755 })
process.env.PATH = `${fake_pi}:${process.env.PATH}`
it.after(() => rmSync(fake_pi, { recursive: true, force: true }))

it('the ship tree carries the harness, prompts, and starting examples', () => {
  execFileSync(
    process.execPath,
    [
      join(project, 'tools/control/scripts/ship-stage.js'),
      '--env',
      'development'
    ],
    {
      env: { ...process.env, REALNESS_PROXY_URL: proxy_url }
    }
  )
  for (const path of ['.pi/prompts/app.md', '.pi/prompts/site.md'])
    assert.ok(existsSync(join(ship, path)), path)
  for (const folder of ['apps', 'artifacts', 'vault', 'work'])
    assert.ok(existsSync(join(ship, folder)), `home has ${folder}/`)
  assert.deepEqual(readdirSync(join(ship, 'work')), [], 'no work ships')
  assert.ok(existsSync(join(ship, 'vault/Projects/site.md')))
  assert.ok(!existsSync(join(ship, 'plans')), 'plans live in the vault')
  assert.equal(
    readFileSync(join(ship, './.ignore'), 'utf8'),
    '',
    'private harness sync is enabled without copying personal rules'
  )
  assert.match(
    readFileSync(join(ship, '.pi/prompts/site.md'), 'utf8'),
    /apps\/site/
  )
  assert.match(
    readFileSync(join(ship, '.pi/prompts/app.md'), 'utf8'),
    /apps\/app/
  )
  for (const name of ['app', 'site'])
    assert.doesNotMatch(
      readFileSync(join(ship, `.pi/prompts/${name}.md`), 'utf8'),
      /giget/
    )
  for (const path of ['.pi/examples/static/src/build.js'])
    assert.ok(existsSync(join(ship, path)), path)
  for (const path of [
    '.pi/examples/static/node_modules',
    '.pi/examples/static/dist',
    '.pi/examples/app',
    '.pi/examples/chat',
    '.pi/examples/terminal'
  ])
    assert.ok(!existsSync(join(ship, path)), path)
  assert.equal(
    JSON.parse(readFileSync(join(ship, 'package.json'), 'utf8')).realness
      ?.examples,
    undefined
  )

  const pkg = JSON.parse(readFileSync(join(ship, 'package.json'), 'utf8'))
  const home = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.deepEqual(pkg.pi, home.pi, 'the actor keeps the home layout')
  assert.ok(existsSync(join(ship, '.pi/extensions/memory/index.js')))
  assert.ok(!existsSync(join(ship, 'extensions')), 'no legacy root extensions')

  const settings = JSON.parse(
    readFileSync(join(ship, '.pi/agent/settings.json'))
  )
  assert.equal(
    `${settings.defaultProvider}/${settings.defaultModel}`,
    'realness/inkling'
  )
  for (const scheme of ['light', 'dark']) {
    const theme = JSON.parse(
      readFileSync(join(ship, `.pi/agent/themes/realness-${scheme}.json`))
    )
    assert.equal(theme.colors.userMessageText, 'accent')
  }
  const harness = JSON.parse(readFileSync(join(ship, '.pi/package.json')))
  assert.ok(harness.dependencies.linkedom, 'web-md dependencies ship')
  assert.ok(existsSync(join(ship, '.pi/package-lock.json')))
  assert.equal(settings.enabledModels, undefined)
  const npm = JSON.parse(readFileSync(join(ship, '.pi/agent/npm/package.json')))
  for (const name of [
    'pi-mcp-adapter',
    'pi-subagents-j0k3r',
    'pi-mono-usage'
  ]) {
    assert.ok(!settings.packages.includes(`npm:${name}`), name)
    assert.ok(!(name in npm.dependencies), name)
  }
  assert.ok(settings.packages.includes('npm:pi-claude-oauth-adapter'))
  assert.ok('pi-claude-oauth-adapter' in npm.dependencies)
  assert.ok(!settings.packages.includes('npm:pi-mono-ask-user-question'))
  const models = JSON.parse(readFileSync(join(ship, '.pi/agent/models.json')))
  assert.deepEqual(Object.keys(models.providers), ['realness'])
  assert.ok(
    models.providers.realness.models.some(model => model.id === 'inkling')
  )
  assert.ok(
    models.providers.realness.models.some(model => model.id === 'house')
  )
  assert.equal(
    models.providers.realness.baseUrl,
    development_settings.services.starter_proxy_url
  )
  assert.equal(models.providers.realness.apiKey, '!realness-model-pass')
  assert.ok(!existsSync(join(ship, 'agent-pass')))
  assert.ok(
    !readFileSync(join(ship, '.pi/agent/models.json'), 'utf8').includes(
      '/etc/realness/agent-pass'
    )
  )

  assert.match(
    readFileSync(join(ship, './.pi-version'), 'utf8'),
    /^\d+\.\d+\.\d+/
  )
  for (const path of [
    'AGENTS.local.md',
    '.pi/agent/auth.json',
    'packages',
    '.pi/agent/sessions'
  ])
    assert.ok(!existsSync(join(ship, path)), path)
})

it('a clean checkout stages the starter without personal Pi settings', () => {
  const scratch = join(project, '../../artifacts/realness-product')
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(join(scratch, 'clean-root-'))
  try {
    for (const path of [
      'package.json',
      '.pi/runtime/release.json',
      '.pi/starter/settings.json',
      '.pi/starter/npm/package.json',
      '.pi/starter/AGENTS.md'
    ]) {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), readFileSync(join(ROOT, path)))
    }
    // The starting examples are tracked harness files, so a clean checkout has them.
    cpSync(join(ROOT, '.pi/examples'), join(root, '.pi/examples'), {
      recursive: true,
      filter: path => !path.split('/').includes('node_modules')
    })
    const stage = ship_stage({ root, stage: join(root, 'ship'), proxy_url })
    assert.equal(
      JSON.parse(readFileSync(join(stage, '.pi/agent/models.json'), 'utf8'))
        .providers.realness.baseUrl,
      proxy_url
    )
    assert.ok(!existsSync(join(root, '.pi/agent/settings.json')))
    const settings = JSON.parse(
      readFileSync(join(stage, '.pi/agent/settings.json'), 'utf8')
    )
    assert.deepEqual(
      settings,
      JSON.parse(readFileSync(join(ROOT, '.pi/starter/settings.json'), 'utf8'))
    )
    assert.deepEqual(
      Object.keys(
        JSON.parse(readFileSync(join(stage, '.pi/agent/models.json'), 'utf8'))
          .providers
      ),
      ['realness']
    )
    assert.ok(existsSync(join(stage, '.pi/agent/npm/package.json')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('home-only skills stay home', () => {
  execFileSync(
    process.execPath,
    [
      join(project, 'tools/control/scripts/ship-stage.js'),
      '--env',
      'development'
    ],
    {}
  )
  for (const name of Object.keys(HOME_ONLY)) {
    assert.ok(
      existsSync(join(ROOT, '.pi/skills', name, 'SKILL.md')),
      `${name} is not a skill at home`
    )
    assert.ok(!existsSync(join(ship, '.pi/skills', name)), `${name} shipped`)
  }
  assert.ok(
    existsSync(join(ship, '.pi/skills/web-md/SKILL.md')),
    'a shared skill ships'
  )
  assert.equal(
    ships(join('.pi', 'skills', 'vuetify-to-semantic', 'SKILL.md')),
    false
  )
  assert.equal(ships(join('.pi', 'skills', 'web-md', 'SKILL.md')), true)
  assert.equal(ships(join('extensions', 'x', 'node_modules', 'y.js')), false)
  assert.equal(
    ships(join('.pi', 'extensions', 'memory', 'artifacts', 'memory', 'x.db')),
    false
  )
  assert.equal(ships(join('bin', '.DS_Store')), false)
  assert.equal(ships('.bash_history'), false)
})

it('the starter names its version and every shipped file', () => {
  execFileSync(
    process.execPath,
    [
      join(project, 'tools/control/scripts/ship-stage.js'),
      '--env',
      'development'
    ],
    {}
  )
  const starter = JSON.parse(readFileSync(join(ship, STARTER), 'utf8'))
  assert.match(starter.version, /^[a-f0-9]{64}$/)
  assert.match(starter.pi, /^\d+\.\d+\.\d+/)
  assert.equal(new Date(starter.built_at).toISOString(), starter.built_at)
  execFileSync(
    process.execPath,
    [
      join(project, 'tools/control/scripts/ship-stage.js'),
      '--env',
      'development'
    ],
    {}
  )
  const rebuilt = JSON.parse(readFileSync(join(ship, STARTER), 'utf8'))
  assert.equal(rebuilt.version, starter.version)
  assert.equal(
    rebuilt.built_at,
    starter.built_at,
    'an identical rebuild keeps its date'
  )
  assert.ok(starter.files['package.json'])
  assert.ok(starter.files['.pi/skills/web-md/SKILL.md'])
  assert.equal(
    starter.files[STARTER],
    undefined,
    'the manifest never lists itself'
  )
  for (const path of [
    'AGENTS.local.md',
    '.pi/agent/auth.json',
    '.pi/skills/editor/SKILL.md'
  ])
    assert.equal(starter.files[path], undefined, path)
  assert.ok(
    Object.keys(starter.files).every(
      path => !path.includes('node_modules') && !path.endsWith('.DS_Store')
    )
  )
})

it('the starter version is stable and content-sensitive', () => {
  const scratch = join(project, '../../artifacts/realness-product')
  mkdirSync(scratch, { recursive: true })
  const one = mkdtempSync(join(scratch, 'starter-'))
  const two = mkdtempSync(join(scratch, 'starter-'))
  try {
    for (const dir of [one, two]) {
      mkdirSync(join(dir, 'nested'))
      writeFileSync(join(dir, 'a.txt'), 'same\n')
      writeFileSync(join(dir, 'nested/b.txt'), 'body\n')
    }
    assert.equal(
      starter_manifest(one).version,
      starter_manifest(two).version,
      'same content, same version'
    )
    writeFileSync(join(two, 'a.txt'), 'changed\n')
    assert.notEqual(
      starter_manifest(one).version,
      starter_manifest(two).version,
      'changed bytes, new version'
    )
    writeFileSync(join(two, 'a.txt'), 'same\n')
    writeFileSync(join(two, 'renamed.txt'), 'same\n')
    rmSync(join(two, 'a.txt'))
    assert.notEqual(
      starter_manifest(one).version,
      starter_manifest(two).version,
      'a rename changes the version'
    )
    assert.equal(
      starter_manifest(one).files['nested/b.txt'],
      starter_manifest(two).files['nested/b.txt']
    )
  } finally {
    rmSync(one, { recursive: true, force: true })
    rmSync(two, { recursive: true, force: true })
  }
})

it('the starter rides in the tarball new actors install', () => {
  execFileSync(
    'bash',
    [join(project, 'tools/control/scripts/harness-stage.sh'), 'development'],
    {}
  )
  const listing = execFileSync(
    'tar',
    ['tzf', out_path('realness-harness.tar.gz')],
    { encoding: 'utf8' }
  )
  assert.ok(
    listing.includes('./.pi/starter.json'),
    'the version and file list ship to the actor'
  )
  assert.ok(listing.includes('./apps/'), 'the empty apps folder ships')
  assert.ok(listing.includes('./.ignore'), 'the default sync rules ship')
})

it('the wrapper lets an installed pi win over the harness copy', () => {
  const wrapper = readFileSync(join(ship, '.pi/bin/pi'), 'utf8')
  assert.match(
    wrapper,
    /^export PATH="\$\(dirname "\$best_node"\):\$PATH:\$root\/\.pi\/bin"$/m
  )
  assert.ok(existsSync(join(ship, '.pi/bin/realness-model-pass')))
})

it('the ship tree rejects a malformed proxy URL', () => {
  assert.throws(
    () => ship_stage({ proxy_url: 'not-a-url' }),
    /proxy_url must be an http\(s\) endpoint/
  )
})

it('the ship tree names the Pi it installs, not the one on this Mac', () => {
  const pinned = JSON.parse(
    readFileSync(join(project, '../../.pi/runtime/release.json'), 'utf8')
  ).version
  const scratch = join(project, '../../artifacts/realness-product')
  mkdirSync(scratch, { recursive: true })
  const bin = mkdtempSync(join(scratch, 'pi-test-'))
  const root = mkdtempSync(join(scratch, 'root-test-'))
  try {
    writeFileSync(join(bin, 'pi'), '#!/bin/sh\necho 9.8.7\n', { mode: 0o755 })
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` }
    execFileSync(
      process.execPath,
      [
        join(project, 'tools/control/scripts/ship-stage.js'),
        '--env',
        'development'
      ],
      { env }
    )
    assert.equal(
      readFileSync(join(ship, './.pi-version'), 'utf8'),
      `${pinned}\n`
    )
    execFileSync(
      'bash',
      [join(project, 'tools/control/scripts/harness-stage.sh'), 'development'],
      { env }
    )
    assert.equal(
      execFileSync(
        'tar',
        ['xOzf', out_path('realness-harness.tar.gz'), './.pi-version'],
        { encoding: 'utf8' }
      ),
      `${pinned}\n`
    )
    const entry = readFileSync(join(project, 'tools/desktop/entry.ts'), 'utf8')
    assert.ok(
      entry.includes('npm:@earendil-works/pi-coding-agent@__PI_VERSION__')
    )
    assert.ok(
      readFileSync(join(project, 'tools/desktop/build.sh'), 'utf8').includes(
        'sed -i \'\' "s|__PI_VERSION__|$pi_version|"'
      )
    )
    mkdirSync(join(root, '.pi/runtime'), { recursive: true })
    writeFileSync(
      join(root, '.pi/runtime/release.json'),
      JSON.stringify({ version: 'unknown' })
    )
    assert.throws(
      () => ship_stage({ root, stage: join(root, 'stage'), proxy_url }),
      /invalid pinned pi version/
    )
  } finally {
    rmSync(bin, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
})

it('each environment bakes its own model proxy; none is assumed', () => {
  assert.match(proxy_for('production'), /276668807926/)
  assert.doesNotMatch(proxy_for('production'), /639469569733|yelzvhhngq/)
  assert.equal(proxy_for('local'), 'http://realness-halo:18097')
  assert.throws(() => proxy_for('nowhere'), /unknown environment/)
  assert.throws(() => ship_stage({}), /proxy_url is required/)
  const bare = spawnSync(
    process.execPath,
    [join(project, 'tools/control/scripts/ship-stage.js')],
    { encoding: 'utf8' }
  )
  assert.notEqual(bare.status, 0)
  assert.match(bare.stderr, /usage: ship-stage.js --env/)
})

it('the actor Pi trusts its own harness, so the terminal never waits on a prompt', () => {
  const stage = ship_stage({
    stage: join(project, '../../artifacts/realness/trust-stage'),
    proxy_url
  })
  assert.deepEqual(
    JSON.parse(readFileSync(join(stage, '.pi/agent/trust.json'), 'utf8')),
    { '/realness': true }
  )
})
