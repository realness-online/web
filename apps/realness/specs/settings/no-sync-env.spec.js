import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { it } from 'node:test'

/** l15: sync addresses come from settings, never from the environment. */
it('no code reads SYNC_URL, SYNC_SITE_URL, SYNC_SITE_PUBLIC_URL, or REALNESS_TURN_SYNC', () => {
  const root = new URL('../..', import.meta.url).pathname
  let found = ''
  try {
    found = execFileSync(
      'grep',
      [
        '-rnE',
        '--exclude-dir=node_modules',
        '(process\\.env|env)\\.(SYNC_URL|SYNC_SITE_URL|SYNC_SITE_PUBLIC_URL|REALNESS_TURN_SYNC)|export (SYNC_URL|SYNC_SITE_URL|SYNC_SITE_PUBLIC_URL)=|SYNC_URL=',
        'src',
        'server',
        'tools',
        'lib'
      ],
      { cwd: root, encoding: 'utf8' }
    )
  } catch (error) {
    if (error.status !== 1) throw error
  }
  assert.equal(found, '')
})
