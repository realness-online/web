#!/usr/bin/env node
// Compatibility entry for harnesses installed before the shared product command.
import { run } from '#root/tools/cli/src/command.js'

process.exitCode = await run(process.argv.slice(2))
