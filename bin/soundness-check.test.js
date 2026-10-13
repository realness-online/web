import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check_text } from './soundness-check.js'

const script = fileURLToPath(new URL('./soundness-check.js', import.meta.url))

const run = cwd => spawnSync(process.execPath, [script, cwd], { cwd, encoding: 'utf8' })

test('a remote script or stylesheet is a hit', () => {
  const found = check_text('page.html', [
    '<script src="https://cdn.example.com/x.js"></script>',
    '<link rel="stylesheet" href="https://cdn.example.com/x.css">',
    'import x from "https://deno.land/std/mod.ts"',
  ].join('\n'))
  assert.equal(found.filter(h => h.rule === 'remote-asset').length, 3)
})

test('a canonical link or preconnect is not a hit', () => {
  const found = check_text('page.html', [
    '<link rel="canonical" href="https://example.com/" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  ].join('\n'))
  assert.equal(found.length, 0)
})

test('a #root import without an import map is a hit', () => {
  const found = check_text('src/page.js', 'import { x } from "#root/src/types.js"')
  assert.equal(found.length, 1)
  assert.equal(found[0].rule, 'root-import')
})

test('a #root string that is not an import is not a hit', () => {
  const found = check_text('src/page.js', 'const key = parsed.imports?.["#root/*"]')
  assert.equal(found.length, 0)
})

test('scoped styles and Transition are hits', () => {
  const found = check_text('Button.vue', [
    '<template><Transition name="fade"><slot /></Transition></template>',
    '<style scoped>button { color: red }</style>',
  ].join('\n'))
  assert.equal(found.filter(h => h.rule === 'vue-scoping').length, 2)
})

test('remote imports are allowed when a Deno project pins them', t => {
  const dir = mkdtempSync(join(tmpdir(), 'soundness-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'deno.json'), '{}')
  const found = check_text(join(dir, 'mod.ts'), 'import x from "https://deno.land/std/x.ts"')
  assert.equal(found.length, 0)
})

test('a Deno project still cannot load a remote script tag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'soundness-'))
  writeFileSync(join(dir, 'deno.json'), '{}')
  const found = check_text(join(dir, 'page.html'), '<script src="https://cdn.example.com/x.js"></script>')
  rmSync(dir, { recursive: true, force: true })
  assert.equal(found.length, 1)
})

test('generated output folders are skipped', t => {
  const dir = mkdtempSync(join(tmpdir(), 'soundness-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, '.nuxt'))
  writeFileSync(join(dir, '.nuxt', 'app.vue'), '<style scoped>x {}</style>')
  writeFileSync(join(dir, 'app.vue'), '<template><p>hi</p></template>')
  const result = run(dir)
  assert.equal(result.status, 0, result.stdout)
  assert.match(result.stdout, /1 files clean/)
})

test('a function declaration is a hit', () => {
  const found = check_text('src/page.js', 'function foo() { return 1 }')
  assert.equal(found.filter(h => h.rule === 'function-keyword').length, 1)
})

test('an arrow function is not a hit', () => {
  const found = check_text('src/page.js', 'const foo = () => 1')
  assert.equal(found.length, 0)
})

test('function in a comment or a string is not a hit', () => {
  const found = check_text('src/page.js', [
    '/** @param {function(): Promise<void>} build */',
    '// call a function later',
    'const kind = typeof build === "function"',
  ].join('\n'))
  assert.equal(found.filter(h => h.rule === 'function-keyword').length, 0)
})

test('a flat descendant selector is a nesting miss', () => {
  const found = check_text('style.css', ['main { color: red }', 'main > header { color: blue }'].join('\n'))
  assert.equal(found.filter(h => h.rule === 'css-nesting').length, 1)
})

test('a nested selector is not a miss', () => {
  const found = check_text('style.css', 'main { color: red; > header { color: blue } }')
  assert.equal(found.filter(h => h.rule === 'css-nesting').length, 0)
})

test('a selector inside a media query is not a miss', () => {
  const found = check_text('style.css', 'main { color: red }\n@media (min-width: 1px) {\n  main > header { color: blue }\n}')
  assert.equal(found.filter(h => h.rule === 'css-nesting').length, 0)
})

test('an identical duplicate is not a nesting miss', () => {
  const found = check_text('style.css', ':root { color: red }\n:root { color: blue }')
  assert.equal(found.filter(h => h.rule === 'css-nesting').length, 0)
})

test('soundness-allow excuses a line and the line after it', () => {
  const found = check_text('Button.vue', [
    '<!-- soundness-allow: framework mechanic -->',
    '<Transition name="fade">',
    '<style scoped>',
  ].join('\n'))
  assert.equal(found.length, 1)
  assert.equal(found[0].line, 3)
})
