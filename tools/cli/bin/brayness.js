#!/usr/bin/env node
import { run } from "../src/command.js"

process.exitCode = await run(process.argv.slice(2))
