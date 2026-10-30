#!/usr/bin/env node
/**
 * realness-read <url> [--fresh] - read a public page through the halo's internet engine.
 *
 * Asks the halo through the door. The halo reads the page from its shared
 * cache, a static fetch, a Chrome VM, or Firecrawl, and replies with JSON on
 * stdout: source, kind (html or markdown), body, title. web-md calls this in an
 * actor and turns the body into markdown.
 */
import { ask, exit } from './realness-door.js'

const args = process.argv.slice(2).filter(arg => arg !== '--fresh')
if (args.length !== 1) exit('usage: realness-read <url> [--fresh]')
try {
  const reply = await ask(
    { op: 'read', url: args[0], fresh: process.argv.includes('--fresh') },
    { timeout_ms: 180_000 }
  )
  if (!reply.ok)
    exit(`realness-read: ${reply.error ?? 'no reply from the halo'}`)
  process.stdout.write(JSON.stringify(reply))
} catch (error) {
  exit(`realness-read: ${error.message}`)
}
