#!/usr/bin/env node
import { run } from '#root/src/command/command.js'

process.exitCode = await run(['store', ...process.argv.slice(2)])
