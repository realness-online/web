#!/usr/bin/env node
/**
 * Set one key in ~/.secrets.zsh from the clipboard, never printing it.
 *
 *   npm run secrets:shell -- OPENROUTER_API_KEY
 */
import { execFileSync as exec_file_sync } from 'node:child_process'
import { chmodSync as chmod_sync, readFileSync as read_file_sync, writeFileSync as write_file_sync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const name = process.argv[2] ?? ''
if (!/^[A-Z][A-Z0-9_]+$/.test(name)) {
  console.error('usage: npm run secrets:shell -- NAME   (copy the new key first)')
  process.exit(1)
}
const value = exec_file_sync('pbpaste', { encoding: 'utf8' }).trim()
if (!value || /\s|'/.test(value)) {
  console.error('The clipboard holds no single key; nothing changed.')
  process.exit(1)
}
const file = join(homedir(), '.secrets.zsh')
const text = read_file_sync(file, 'utf8')
const line = new RegExp(`^export ${name}=.*$`, 'm')
const next = line.test(text)
  ? text.replace(line, () => `export ${name}='${value}'`)
  : `${text.trimEnd()}\n\nexport ${name}='${value}'\n`
write_file_sync(file, next)
chmod_sync(file, 0o600)
console.log(`${name} set in ~/.secrets.zsh, ending ...${value.slice(-4)}. Open a new terminal tab to load it.`)
