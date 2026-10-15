/**
 * The actor's `realness` launcher starts Pi in work/, where Pi finds no
 * project extensions, so it loads the chat bridge by path. Without it the
 * browser chat reports "Pi is not running in the terminal".
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { out_path } from '#root/lib/output.js'

const build = readFileSync(
  new URL('../../tools/control/scripts/template-build.sh', import.meta.url),
  'utf8'
)
const wrapper = build.match(
  /usr\/local\/bin\/realness" <<'WRAPPER'\n([\s\S]*?)\nWRAPPER/
)[1]

/** Run the launcher from `cwd` with Pi replaced by an argument printer. */
const pi_args = (cwd, args = []) => {
  const dir = mkdtempSync(out_path('actor-launcher-'))
  const launcher = join(dir, 'realness')
  writeFileSync(
    launcher,
    wrapper.replace('exec /realness/bin/pi "$@"', 'printf "%s\\n" "$@"')
  )
  mkdirSync(cwd, { recursive: true })
  return execFileSync('bash', [launcher, ...args], { cwd, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

test('Pi started outside the harness still loads the chat bridge', () => {
  const work = out_path('actor-launcher-work')
  assert.deepEqual(pi_args(work, ['-c']), [
    '--extension',
    '/realness/.pi/extensions/chat-bridge/index.js',
    '-c'
  ])
})

test('the launcher keeps subcommands off Pi', () => {
  assert.match(wrapper, /exec \/usr\/local\/bin\/realness-publish/)
  assert.match(wrapper, /if \[ "\$PWD" != \/realness \]/)
})
