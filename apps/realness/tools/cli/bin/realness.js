#!/usr/bin/env node
import { run } from '#root/src/command/command.js'
import { is_actor } from '#root/src/harness/settings.js'

const args = process.argv.slice(2)
/** @type {Parameters<typeof run>[1]} */
const options = { actor: is_actor() }
/** `--sync <url>` points one run at another sync, such as a test server. */
const sync_at = args.indexOf('--sync')
if (sync_at >= 0) options.service_url = args.splice(sync_at, 2)[1]
if (!options.actor && args[0] === 'example' && args[1] === 'static')
  options.export_static = (
    await import('../../../src/publish/view.js')
  ).export_static

process.exitCode = await run(args, options)
