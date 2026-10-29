#!/usr/bin/env node
import {
  describe_icloud_status,
  WAIT_TIMEOUT_MS,
  wait_for_icloud
} from '#root/src/control/icloud.js'

const args = process.argv.slice(2)
if (args.some(arg => arg !== '--wait')) {
  process.stderr.write('usage: npm run icloud:status -- [--wait]\n')
  process.exitCode = 2
} else {
  const wait = args.includes('--wait')
  let last = ''
  const show = status => {
    const line = describe_icloud_status(status)
    if (line === last) return
    last = line
    process.stdout.write(`${line}\n`)
  }
  const status = await wait_for_icloud({
    on_status: wait ? show : () => {},
    timeout_ms: wait ? WAIT_TIMEOUT_MS : 0
  })
  if (!wait) show(status)
  if (wait && status.timed_out)
    process.stderr.write('iCloud did not catch up within 30 minutes\n')
  process.exitCode = status.ready ? 0 : 1
}
