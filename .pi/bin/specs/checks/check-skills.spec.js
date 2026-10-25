import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  check_command,
  check_needs,
  check_skill,
  path_claims,
  run_check,
  split_fences
} from '../../checks/check-skills.js'

const artifacts = fileURLToPath(new URL('../../../../artifacts/', import.meta.url))
const root = join(artifacts, `check-skills-test-${process.pid}`)

const skill = (name, body, files = {}, check = 'true') => {
  const dir = join(root, 'skills', name)
  mkdirSync(dir, { recursive: true })
  const meta = check ? `\nmetadata:\n  check: ${check}` : ''
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Test. Use when testing.${meta}\n---\n\n${body}\n`
  )
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

it('a clean skill has nothing to report', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'work/realness'), { recursive: true })
  const dir = skill('clean', 'Run `scripts/ok.js`. Prose like `owner/repo` and `work/absent/x.md` is ignored.', {
    'scripts/ok.js': 'export const ok = 1\n'
  })
  const result = await check_skill(dir, root)
  assert.deepEqual([result.errors, result.warnings, result.name], [[], [], 'clean'])
})

it('stale paths, broken scripts, and long code blocks are reported', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'work/realness'), { recursive: true })
  const block = '```js\n' + 'x\n'.repeat(16) + '```'
  const dir = skill('broken', `See \`work/realness/.tooling.md\` and [ref](references/gone.md).\n\n${block}`, {
    'scripts/bad.js': 'const = 1\n',
    'scripts/bad.sh': 'if then\n',
    'references/here.md': 'x\n'
  })
  const { errors, warnings } = await check_skill(dir, root)
  assert.equal(errors.length, 2)
  assert.match(errors.join('\n'), /bad\.js does not parse/)
  assert.match(errors.join('\n'), /bad\.sh does not parse/)
  assert.match(warnings.join('\n'), /work\/realness\/\.tooling\.md/)
  assert.match(warnings.join('\n'), /references\/gone\.md/)
  assert.match(warnings.join('\n'), /1 code block over 15 lines \(longest 16\)/)
})

it('derived runtime state is not a stale path', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.pi/agent'), { recursive: true })
  const dir = skill('derived', 'The index lives at `.pi/agent/memory.db`.')
  const { warnings } = await check_skill(dir, root)
  assert.deepEqual(warnings, [])
})

it('a missing file beside derived state is still reported', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, '.pi/agent'), { recursive: true })
  const dir = skill('stale', 'The store lives at `.pi/agent/other.db`.')
  const { warnings } = await check_skill(dir, root)
  assert.match(warnings.join('\n'), /\.pi\/agent\/other\.db/)
})

it('paths inside code blocks and placeholders are not claims', () => {
  const { prose, blocks } = split_fences('a `skills/x/y.md`\n```\n`skills/z/q.md`\n```\n`<skill-dir>/scripts/a.js`')
  assert.deepEqual(blocks, [1])
  assert.deepEqual(path_claims(prose), ['skills/x/y.md'])
})

it('a skill without metadata.check is an error', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const { errors } = await check_skill(skill('unchecked', 'Prose.', {}, null), root)
  assert.match(errors.join('\n'), /no metadata\.check/)
})

it('check commands unquote as YAML does, and run in the skill folder', async t => {
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const front = check => `---\nname: x\nmetadata:\n  category: Tools\n  check: ${check}\n---\n`
  assert.equal(check_command(front("'python3 -c ''print(1)'''")), "python3 -c 'print(1)'")
  assert.equal(check_command(front('"a && b"')), 'a && b')
  assert.equal(check_command('---\nname: x\n---\n'), null)
  assert.equal(check_needs('---\nname: x\nmetadata:\n  check: a\n  needs: browser\n---\n'), 'browser')
  assert.equal(check_needs(front('a')), null)
  const dir = skill('runs', 'Prose.', { 'here.txt': 'x\n' })
  assert.equal(await run_check(dir, 'test -f here.txt'), null)
  assert.match(await run_check(dir, 'echo nope >&2; exit 3'), /check failed: .*\(nope\)/)
})
