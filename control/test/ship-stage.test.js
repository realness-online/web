import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const project = new URL('../../', import.meta.url).pathname
const ship = join(project, 'dist/ship')
const proxy_url = 'http://127.0.0.1:18788'

test('the ship tree carries the harness and prompts, no examples', () => {
  execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
    env: { ...process.env, BRAYNESS_PROXY_URL: proxy_url },
  })
  for (const path of ['prompts/app.md', 'prompts/site.md'])
    assert.ok(existsSync(join(ship, path)), path)
  // Prompts download the examples; none ride in the ship tree.
  for (const name of ['app', 'site'])
    assert.match(readFileSync(join(ship, `prompts/${name}.md`), 'utf8'), /giget gh:scott-fryxell\/brayness-examples\//)

  const extensions = join(ship, '.pi/agent/extensions')
  assert.equal(readlinkSync(extensions), '../../extensions')
  assert.ok(existsSync(join(extensions, 'memory/index.ts')))
  // Without this link /site and /app reach the model as literal text.
  const prompts = join(ship, '.pi/agent/prompts')
  assert.equal(readlinkSync(prompts), '../../prompts')
  assert.ok(existsSync(join(prompts, 'site.md')))

  const settings = JSON.parse(readFileSync(join(ship, '.pi/agent/settings.json')))
  assert.equal(`${settings.defaultProvider}/${settings.defaultModel}`, 'brayness/inkling')
  // The Mac's model list must not travel, and no pin: other providers stay
  // open, so Pi cycles every authenticated model.
  assert.equal(settings.enabledModels, undefined)
  const npm = JSON.parse(readFileSync(join(ship, '.pi/agent/npm/package.json')))
  for (const name of ['pi-mcp-adapter', 'pi-subagents-j0k3r', 'pi-mono-usage']) {
    assert.ok(!settings.packages.includes(`npm:${name}`), name)
    assert.ok(!(name in npm.dependencies), name)
  }
  // A shipped actor may sign in with a Claude subscription instead of the proxy.
  assert.ok(settings.packages.includes('npm:pi-claude-oauth-adapter'))
  assert.ok('pi-claude-oauth-adapter' in npm.dependencies)
  assert.ok(settings.packages.includes('npm:pi-mono-ask-user-question'))
  const models = JSON.parse(readFileSync(join(ship, '.pi/agent/models.json')))
  assert.deepEqual(Object.keys(models.providers), ['brayness'])
  assert.ok(models.providers.brayness.models.some(model => model.id === 'inkling'))
  assert.ok(models.providers.brayness.models.some(model => model.id === 'house'))
  assert.equal(models.providers.brayness.baseUrl, proxy_url)
  assert.equal(models.providers.brayness.apiKey, '!brayness-model-pass')
  assert.ok(!existsSync(join(ship, 'agent-pass')))
  assert.ok(!readFileSync(join(ship, '.pi/agent/models.json'), 'utf8').includes('/etc/brayness/agent-pass'))

  assert.match(readFileSync(join(ship, '.pi-version'), 'utf8'), /^\d+\.\d+\.\d+/)
  for (const path of [
    'AGENTS.local.md', '.pi/agent/auth.json', 'work', 'examples', 'packages',
    'skills/brayness-sync/published',
  ]) assert.ok(!existsSync(join(ship, path)), path)
})

test('the wrapper lets an installed pi win over the harness copy', () => {
  // $root/bin last: put first, bin/pi resolves `pi` to itself, skips the guard,
  // and fetches pi from the registry - a failure offline, a cost every start.
  const wrapper = readFileSync(join(ship, 'bin/pi'), 'utf8')
  assert.match(wrapper, /^export PATH="\$\(dirname "\$best_node"\):\$PATH:\$root\/bin"$/m)
  assert.ok(existsSync(join(ship, 'bin/brayness-model-pass')))
})

test('the ship tree rejects a malformed proxy URL', () => {
  assert.throws(() => execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
    env: { ...process.env, BRAYNESS_PROXY_URL: 'not-a-url' },
    stdio: 'pipe',
  }), /BRAYNESS_PROXY_URL/)
})

test('the ship tree captures one local version and rejects invalid versions', () => {
  const scratch = join(project, '../../artifacts/brayness-product')
  mkdirSync(scratch, { recursive: true })
  const bin = mkdtempSync(join(scratch, 'pi-test-'))
  try {
    writeFileSync(join(bin, 'pi'), '#!/bin/sh\necho 9.8.7\n', { mode: 0o755 })
    execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BRAYNESS_PROXY_URL: proxy_url },
    })
    assert.equal(readFileSync(join(ship, '.pi-version'), 'utf8'), '9.8.7\n')
    execFileSync('bash', [join(project, 'control/scripts/harness-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BRAYNESS_PROXY_URL: proxy_url },
    })
    assert.equal(execFileSync('tar', ['xOzf', join(project, 'dist/brayness-harness.tar.gz'), './.pi-version'], { encoding: 'utf8' }), '9.8.7\n')
    const entry = readFileSync(join(project, 'app/entry.ts'), 'utf8')
    assert.ok(entry.includes('npm:@earendil-works/pi-coding-agent@__PI_VERSION__'))
    assert.ok(entry.replace('__PI_VERSION__', '9.8.7').includes('npm:@earendil-works/pi-coding-agent@9.8.7'))
    assert.ok(readFileSync(join(project, 'app/build.sh'), 'utf8').includes('sed -i \'\' "s|__PI_VERSION__|$pi_version|"'))
    writeFileSync(join(bin, 'pi'), '#!/bin/sh\necho unknown\n', { mode: 0o755 })
    assert.throws(() => execFileSync('bash', [join(project, 'control/scripts/ship-stage.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BRAYNESS_PROXY_URL: proxy_url },
      stdio: 'pipe',
    }), /invalid local pi version/)
    assert.equal(readFileSync(join(ship, '.pi-version'), 'utf8'), '9.8.7\n')
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
})
