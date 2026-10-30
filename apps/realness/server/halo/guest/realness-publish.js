#!/usr/bin/env node
/**
 * realness publish [dir] - serve a built site from this actor.
 *
 * Asks the halo through the door. The halo copies the directory out and serves
 * it at /s/<actor>/; this prints the link. The directory defaults to
 * /realness/site and should hold built HTML.
 */
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { ask_ok, exit } from './realness-door.js'

const SITE_ROOT = '/realness/work/site'
const SITE_ID = join(SITE_ROOT, '.realness-site-id')
const path = resolve(process.argv[2] ?? '/realness/site')
if (!exists_sync(join(path, 'index.html')))
  exit(`realness publish: ${path} has no index.html; build the site first`)

const inside = path === SITE_ROOT || path.startsWith(`${SITE_ROOT}/`)
const request = { op: 'publish', path }
if (inside)
  try {
    const site = read_file_sync(SITE_ID, 'utf8').trim()
    if (!/^a-[a-f0-9]{12}$/.test(site))
      exit('realness publish: invalid saved site ID')
    request.site = site
  } catch (error) {
    if (error.code !== 'ENOENT') exit(`realness publish: ${error.message}`)
  }

const reply = await ask_ok('realness publish', request, { timeout_ms: 120_000 })
if (inside && reply.site) write_file_sync(SITE_ID, `${reply.site}\n`)
process.stdout.write(`published ${path}\n${reply.url}\n`)
