#!/usr/bin/env node
import { run } from '../../../src/command/command.js'

process.exitCode = await run(process.argv.slice(2), { actor: true })
