import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { join, normalize } from 'node:path'
import { it } from 'node:test'

const root = join(import.meta.dirname, '../../../..')
const app = 'apps/realness'
const scripts = folder => JSON.parse(read_file_sync(join(root, folder, 'package.json'), 'utf8')).scripts ?? {}

/**
 * The scripts a command ends up running, as `folder#script`, following
 * `npm run`, `npm test`, and `npm --prefix` down to scripts that run no npm.
 * @param {string} folder
 * @param {string} name
 * @param {Set<string>} [found]
 * @returns {Set<string>}
 */
const leaves = (folder, name, found = new Set()) => {
  const body = scripts(folder)[name]
  assert.ok(body !== undefined, `${folder}#${name} is not a script`)
  const calls = [...body.matchAll(/npm (?:--prefix (\S+) )?(?:run ([\w:-]+)|(test))/g)]
  if (!calls.length) return found.add(`${folder}#${name}`)
  for (const [, prefix, script, test] of calls)
    leaves(prefix ? normalize(join(folder, prefix)) : folder, script ?? test, found)
  return found
}

/** Every check the git hook runs, as `folder#script`. */
const hook_checks = () => {
  const hook = read_file_sync(join(root, '.pi/bin/hooks/pre-commit'), 'utf8')
  const found = new Set()
  for (const [, command] of hook.matchAll(/^\s*check [\w-]+ (.+)$/gm)) {
    const ran = command.match(/^"\$\{app\[@\]\}" ([\w:-]+)/)
    if (ran) for (const leaf of leaves(app, ran[1])) found.add(leaf)
    const root_run = command.match(/^npm run ([\w:-]+)/)
    if (root_run) for (const leaf of leaves('.', root_run[1])) found.add(leaf)
    if (command.startsWith('node .pi/bin/checks/comment-check.js')) found.add('.#check:comments')
  }
  return found
}

it('the git hook and npm test run the same checks, so neither can drop one', () => {
  const tested = [...leaves('.', 'test')].sort()
  const hooked = [...hook_checks()].sort()
  assert.deepEqual(hooked, tested)
  for (const required of [
    `${app}#type`,
    `${app}#check:frontend`,
    `${app}#dead-code`,
    `${app}#test:coverage`,
    '.#check:skills'
  ])
    assert.ok(tested.includes(required), `${required} must run in npm test`)
})
