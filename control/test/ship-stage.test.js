import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const project = new URL('../../', import.meta.url).pathname
const ship = join(project, 'dist/ship')

test('both delivery modes get the source-only app and site from one ship tree', () => {
  execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')])
  for (const path of [
    'work/brayness/examples/app/package.json', 'work/brayness/examples/site/build.js',
    'work/realness/packages/itemid/src/index.js', 'work/realness/packages/store/src/index.js',
    'prompts/app.md',
  ]) assert.ok(existsSync(join(ship, path)), path)

  const extensions = join(ship, '.pi/agent/extensions')
  assert.equal(readlinkSync(extensions), '../../extensions')
  assert.ok(existsSync(join(extensions, 'memory/index.ts')))

  const settings = JSON.parse(readFileSync(join(ship, '.pi/agent/settings.json')))
  assert.equal(`${settings.defaultProvider}/${settings.defaultModel}`, 'realness/inkling')
  assert.deepEqual(settings.enabledModels, ['realness/inkling'])
  const npm = JSON.parse(readFileSync(join(ship, '.pi/agent/npm/package.json')))
  for (const name of ['pi-claude-oauth-adapter', 'pi-mcp-adapter', 'pi-subagents-j0k3r', 'pi-mono-usage']) {
    assert.ok(!settings.packages.includes(`npm:${name}`), name)
    assert.ok(!(name in npm.dependencies), name)
  }
  assert.ok(settings.packages.includes('npm:pi-mono-ask-user-question'))
  const models = JSON.parse(readFileSync(join(ship, '.pi/agent/models.json')))
  assert.ok(models.providers.realness.models.some(model => model.id === 'inkling'))
  assert.ok(!existsSync(join(ship, 'agent-pass')))

  const app_dir = join(ship, 'work/brayness/examples/app')
  const app = JSON.parse(readFileSync(join(app_dir, 'package.json')))
  for (const name of ['itemid', 'store']) {
    const link = app.dependencies[`@realness/${name}`]
    assert.equal(link, `file:../../../realness/packages/${name}`)
    assert.ok(existsSync(join(app_dir, link.slice(5), 'package.json')), link)
  }
  assert.match(readFileSync(join(ship, '.pi-version'), 'utf8'), /^\d+\.\d+\.\d+/)
  for (const path of [
    'AGENTS.local.md', '.pi/agent/auth.json', 'work/brayness/examples/app/node_modules',
    'work/brayness/examples/site/node_modules', 'work/brayness/examples/app/package-lock.json',
    'work/brayness/examples/app/data', 'examples', 'packages',
  ]) assert.ok(!existsSync(join(ship, path)), path)
})

test('the ship tree captures one local version and rejects invalid versions', () => {
  const scratch = join(project, '../../artifacts/brayness-product')
  mkdirSync(scratch, { recursive: true })
  const bin = mkdtempSync(join(scratch, 'pi-test-'))
  try {
    writeFileSync(join(bin, 'pi'), '#!/bin/sh\necho 9.8.7\n', { mode: 0o755 })
    execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    assert.equal(readFileSync(join(ship, '.pi-version'), 'utf8'), '9.8.7\n')
    execFileSync('bash', [join(project, 'control/scripts/harness-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    })
    assert.equal(execFileSync('tar', ['xOzf', join(project, 'dist/brayness-harness.tar.gz'), './.pi-version'], { encoding: 'utf8' }), '9.8.7\n')
    const entry = readFileSync(join(project, 'app/entry.ts'), 'utf8')
    assert.ok(entry.includes('npm:@earendil-works/pi-coding-agent@__PI_VERSION__'))
    assert.ok(entry.replace('__PI_VERSION__', '9.8.7').includes('npm:@earendil-works/pi-coding-agent@9.8.7'))
    assert.ok(readFileSync(join(project, 'app/build.sh'), 'utf8').includes('sed -i \'\' "s|__PI_VERSION__|$pi_version|"'))
    writeFileSync(join(bin, 'pi'), '#!/bin/sh\necho unknown\n', { mode: 0o755 })
    assert.throws(() => execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      stdio: 'pipe',
    }), /invalid local pi version/)
    assert.equal(readFileSync(join(ship, '.pi-version'), 'utf8'), '9.8.7\n')
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
})
