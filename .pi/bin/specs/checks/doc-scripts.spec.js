import { it } from 'node:test'
import assert from 'node:assert/strict'
import { missing_scripts } from '../../checks/doc-scripts.js'

const scripts = new Set(['check', 'dev:frontend'])

it('a doc that names a missing script fails', () => {
  assert.deepEqual(missing_scripts({ 'a.md': 'Run `npm run dev`.' }, scripts), ['a.md: npm run dev'])
})

it('scripts that exist pass, with or without a prefix', () => {
  assert.deepEqual(
    missing_scripts({ 'a.md': '`npm run check` and `npm --prefix apps/realness run dev:frontend`' }, scripts),
    []
  )
})

it('a quoted md block from another project is not checked', () => {
  assert.deepEqual(missing_scripts({ 'a.md': '```md\n- `npm run logs:errors`\n```\n' }, scripts), [])
})
