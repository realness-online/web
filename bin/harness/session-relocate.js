#!/usr/bin/env node
import { relocate_history, restore_history } from '../lib/session-relocation.js'
import { migrate_sessions, rollback_sessions } from '../lib/session-cutover.js'

const [action, harness, source, target, state, deferred, ...extra] = process.argv.slice(2)
if (extra.length) throw new Error('Too many arguments')
let result
if (action === 'migrate' && !harness) result = migrate_sessions()
else if (action === 'rollback' && !harness) result = rollback_sessions()
else if (action === 'trial-migrate' && harness && !source) result = migrate_sessions(harness, { trial: true })
else if (action === 'trial-rollback' && harness && !source) result = rollback_sessions(harness, { trial: true })
else if (action === 'trial-copy' && harness && source && target) result = relocate_history({ harness, source, target, state, deferred })
else if (action === 'trial-restore' && harness && !source) result = restore_history(harness)
else throw new Error('Usage: session-relocate.js migrate | rollback | trial-migrate <copied-harness> | trial-rollback <copied-harness> | trial-copy <copied-harness> <source> <target> [state] [deferred] | trial-restore <manifest>')
process.stdout.write(JSON.stringify(result) + '\n')
