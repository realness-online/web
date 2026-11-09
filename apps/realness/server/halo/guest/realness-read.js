#!/usr/bin/env node
/**
 * realness-read <url> [--fresh] [--site <slug>] - read a page through the halo.
 *
 * A `--site` names the cookie jar the read uses, so a logged-in source reads
 * signed in: the halo leases a copy, loads the jar, reads, and gives it back.
 *
 * Asks the halo through the door. The halo reads the page from its shared
 * cache, a static fetch, a Chrome VM, or Firecrawl, and replies with JSON on
 * stdout: source, kind (html or markdown), body, title. web-md calls this in an
 * actor and turns the body into markdown.
 */
import { ask, exit } from './realness-door.js'

const argv = process.argv.slice(2)
const site_at = argv.indexOf('--site')
const site = site_at === -1 ? null : argv[site_at + 1]
const args = argv.filter(
  (arg, i) => arg !== '--fresh' && arg !== '--site' && i !== site_at + 1
)
if (args.length !== 1)
  exit('usage: realness-read <url> [--fresh] [--site <slug>]')
try {
  const reply = await ask(
    {
      op: 'read',
      url: args[0],
      fresh: argv.includes('--fresh'),
      ...(site ? { site } : {})
    },
    { timeout_ms: 180_000 }
  )
  if (!reply.ok)
    exit(`realness-read: ${reply.error ?? 'no reply from the halo'}`)
  process.stdout.write(JSON.stringify(reply))
} catch (error) {
  exit(`realness-read: ${error.message}`)
}
