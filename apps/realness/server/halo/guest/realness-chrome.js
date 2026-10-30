#!/usr/bin/env node
/**
 * realness chrome [lease|return] - lease a fresh Chrome from the halo, or give it back.
 *
 * A lease prints the copy's DevTools address; connect agent-browser to it:
 *
 *     agent-browser connect "$(realness chrome)"
 *
 * The copy can open this actor's own dev server (http://<this actor's address>:<port>).
 * It lasts 30 minutes, or until `realness chrome return`; a returned copy is destroyed.
 */
import { ask, exit } from './realness-door.js'

const [action] = process.argv.slice(2)
if (![undefined, 'lease', 'return'].includes(action))
  exit('usage: realness chrome [lease|return]')
const op = action === 'return' ? 'chrome-return' : 'chrome-lease'
try {
  const reply = await ask({ op }, { timeout_ms: 180_000 })
  if (!reply.ok)
    exit(`realness chrome: ${reply.error ?? 'no reply from the halo'}`)
  if (op === 'chrome-return')
    process.stdout.write(
      `${reply.returned ? 'returned' : 'no chrome was leased'}\n`
    )
  else {
    process.stdout.write(`${reply.devtools}\n`)
    process.stderr.write(`until ${reply.expires}\n`)
  }
} catch (error) {
  exit(`realness chrome: ${error.message}`)
}
