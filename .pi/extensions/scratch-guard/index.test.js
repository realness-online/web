import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import guard, { names_system_temp, with_scratch_tmpdir } from './index.js'

const root = '/h'
const setup = () => {
  const handlers = {}
  guard(
    {
      on: (name, fn) => {
        handlers[name] = fn
      }
    },
    { root }
  )
  return (toolName, input) => handlers.tool_call({ toolName, input })
}

test('system temp paths are named; look-alikes are not', () => {
  for (const [text, named] of [
    ['echo x > /tmp/a', '/tmp'],
    ['cd /tmp && ls', '/tmp'],
    ['cat /private/tmp/x.json', '/private/tmp'],
    ['ls /var/folders/xy/T/', '/var/folders'],
    ["node -e \"require('fs').writeFileSync('/tmp/b', '')\"", '/tmp'],
    ['mv a /tmp', '/tmp']
  ])
    assert.equal(names_system_temp(text), named, text)
  for (const text of [
    'npm test',
    'ls artifacts/tmp/x',
    'cat ./tmp/x',
    'echo $TMPDIR/a',
    'git log --tmpfile',
    'ls /tmpl'
  ])
    assert.equal(names_system_temp(text), null, text)
})

test('a mktemp that names no folder is caught; one under TMPDIR or artifacts passes', () => {
  for (const text of ['f=$(mktemp)', 'mktemp -d', 'mktemp -t x && ls'])
    assert.match(names_system_temp(text), /mktemp/, text)
  for (const text of [
    'f=$(mktemp "$TMPDIR/x.XXXXXX")',
    'mktemp -d ${TMPDIR}/d.XXXX',
    'mktemp artifacts/realness/x.XXXX'
  ])
    assert.equal(names_system_temp(text), null, text)
})

test('bash, write, and edit naming /tmp are blocked with the folder to use', () => {
  const call = setup()
  for (const [tool, input] of [
    ['bash', { command: 'echo x > /tmp/a' }],
    ['write', { path: '/tmp/a.mjs', content: '' }],
    ['edit', { path: '/private/tmp/b', edits: [] }]
  ]) {
    const result = call(tool, input)
    assert.equal(result?.block, true, tool)
    assert.match(result.reason, /artifacts\/<project>\//)
    assert.match(result.reason, /\/h\/artifacts\/tmp\//)
  }
})

test('other calls pass; bash runs with TMPDIR in artifacts/tmp', () => {
  const call = setup()
  const input = { command: 'npm test' }
  assert.equal(call('bash', input), undefined)
  assert.equal(input.command, 'export TMPDIR="/h/artifacts/tmp"; mkdir -p "$TMPDIR"\nnpm test')
  assert.equal(call('write', { path: 'artifacts/realness/a.md', content: '' }), undefined)
  assert.equal(call('read', { path: '/tmp/anything' }), undefined)
})

test('the prefix moves os.tmpdir and a mktemp under $TMPDIR into artifacts', () => {
  const tmp = new URL('../../../artifacts/tmp-guard-test', import.meta.url).pathname
  const script = with_scratch_tmpdir('mktemp "$TMPDIR/x.XXXXXX"; node -p "require(\'os\').tmpdir()"', tmp)
  const [made, node_tmp] = execFileSync('bash', ['-c', script], { encoding: 'utf8' }).trim().split('\n')
  assert.ok(made.startsWith(`${tmp}/x.`), made)
  assert.equal(node_tmp, tmp)
  execFileSync('rm', ['-rf', tmp])
})
