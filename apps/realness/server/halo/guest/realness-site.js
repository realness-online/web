#!/usr/bin/env node
/**
 * Manage the actor's published site through the halo door.
 *
 *   realness-site versions
 *   realness-site restore <version>
 *   realness-site remove
 *
 * Use `realness-publish <dir>` to publish or revise the site.
 */
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { ask_ok, exit } from './realness-door.js'

const SITE_ROOT = '/realness/work/site'
const SITE_ID = join(SITE_ROOT, '.realness-site-id')
const OPS = {
  versions: 'site-versions',
  restore: 'site-restore',
  remove: 'site-remove'
}

const [action, version] = process.argv.slice(2)
if (!OPS[action] || (action === 'restore') !== (version !== undefined))
  exit('usage: realness-site versions|restore <version>|remove')

const request = { op: OPS[action] }
try {
  const site = read_file_sync(SITE_ID, 'utf8').trim()
  if (!/^a-[a-f0-9]{12}$/.test(site))
    exit('realness-site: invalid saved site ID')
  request.site = site
} catch (error) {
  if (error.code !== 'ENOENT') exit(`realness-site: ${error.message}`)
}
if (action === 'restore') request.version = version

const reply = await ask_ok('realness-site', request, { timeout_ms: 120_000 })
if (action === 'versions')
  for (const one of reply.versions)
    process.stdout.write(`${one.id} ${one.saved}\n`)
else if (action === 'restore') process.stdout.write(`${reply.url}\n`)
else
  process.stdout.write(`unpublished; restore with version ${reply.version}\n`)
