#!/usr/bin/env node
import { run } from '../../../src/command/command.js'
import { is_actor } from '../../../src/harness/settings.js'

const args = process.argv.slice(2)
/** @type {Parameters<typeof run>[1]} */
const options = { actor: is_actor() }
if (!options.actor && args[0] === 'example' && args[1] === 'static')
  options.export_static = (await import('../../../src/publish/view.js')).export_static

process.exitCode = await run(args, options)
