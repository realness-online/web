#!/usr/bin/env node
// Keep the old command name; all dispatch belongs to the product entry.
import { run } from '#root/tools/cli/src/command.js'

process.exitCode = await run(['store', ...process.argv.slice(2)])
