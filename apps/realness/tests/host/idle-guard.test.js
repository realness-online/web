/** systemd execs the idle check directly, so it needs its own interpreter line. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('the idle check written by idle-guard.sh starts with a shebang', () => {
  const guard = readFileSync(
    new URL('../../server/host/scripts/idle-guard.sh', import.meta.url),
    'utf8'
  )
  const check = guard.match(/cat > "\$CHECK" <<'SH'\n([\s\S]*?)\nSH\n/)[1]
  assert.match(check, /^#!\/usr\/bin\/env bash\n/)
})
