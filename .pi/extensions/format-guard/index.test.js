import { test } from 'node:test'
import assert from 'node:assert/strict'
import guard, { prettier_rewrites_code } from './index.js'

test('prettier rewriting code is caught, however it is reached', () => {
  for (const command of [
    'npx prettier --write src/a.js',
    'cd apps/realness; npx prettier --write specs/x.spec.js src/command/*.js >/dev/null',
    'node_modules/.bin/prettier -w a.vue',
    'prettier --write .',
    'npx prettier --write notes.md src/a.js',
    'npx prettier --write .pi/runtime/x.js',
    'npx prettier --write .pi/bin/a.js apps/realness/src/a.js'
  ])
    assert.ok(prettier_rewrites_code(command), command)
})

test('markdown, checks, and other tools pass', () => {
  for (const command of [
    'npx prettier --write notes.md "vault/a b.md"',
    'npx prettier --check src/a.js',
    'npx vp fmt src/a.js',
    'rg -n prettier .pi',
    'cat .prettierrc.json',
    'npm ls prettier',
    '.pi/node_modules/.bin/prettier --write .pi/bin/plans/plans.js .pi/extensions/x/index.js'
  ])
    assert.equal(prettier_rewrites_code(command), null, command)
})

test('the bash call is blocked with the command to use', () => {
  const handlers = {}
  guard({ on: (name, fn) => (handlers[name] = fn) })
  const blocked = handlers.tool_call({
    toolName: 'bash',
    input: { command: 'npx prettier --write a.js' }
  })
  assert.equal(blocked.block, true)
  assert.match(blocked.reason, /vp fmt/)
  assert.equal(handlers.tool_call({ toolName: 'bash', input: { command: 'ls' } }), undefined)
})
