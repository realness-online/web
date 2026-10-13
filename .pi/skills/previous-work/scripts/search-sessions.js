#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { search_pi } from './search-pi.js'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const home = homedir()
const pi_dir = process.env.PI_CODING_AGENT_DIR ?? join(root, '.pi/agent')
const current_session = process.env.PI_SESSION_ID

const args = process.argv.slice(2)
const take_flag = name => {
  const i = args.indexOf(name)
  if (i !== -1) args.splice(i, 1)
  return i !== -1
}
const take_value = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args.splice(i, 2)[1]
}

const recent = take_flag('--recent')
const limit = Number(take_value('--limit', '3'))
const term = args.join(' ').trim()
if (!term || !(limit > 0)) {
  console.error(
    'usage: search-sessions.js "<exact string>" [--limit N] [--recent]'
  )
  process.exit(2)
}

const stores = [
  { name: 'pi', dir: join(pi_dir, 'sessions'), glob: '*.jsonl' },
  {
    name: 'cursor',
    dir: join(home, '.cursor/projects'),
    glob: '**/agent-transcripts/**/*.jsonl'
  },
  { name: 'claude', dir: join(home, '.claude/projects'), glob: '*.jsonl' }
]

/** @param {string[]} rg_args */
const rg = async rg_args => {
  try {
    const { stdout } = await run('rg', rg_args, { maxBuffer: 64 * 1024 * 1024 })
    return stdout
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('rg not found')
      process.exit(2)
    }
    return error.stdout ?? ''
  }
}

const literal = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const search = async ({ name, dir, glob }) => {
  if (name === 'pi') return search_pi({ dir, term, current_session, recent, limit })
  if (!existsSync(dir)) return { name, missing: dir, total: 0, files: [] }
  const out = await rg(['--no-ignore', '-c', '-i', '-F', '-g', glob, '--', term, dir])
  const files = out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const at = line.lastIndexOf(':')
      const file = line.slice(0, at)
      return { file, count: Number(line.slice(at + 1)), mtime: statSync(file).mtimeMs }
    })
    .filter(({ file }) => !current_session || !file.includes(current_session))
  files.sort(recent ? (a, b) => b.mtime - a.mtime : (a, b) => b.count - a.count)
  return { name, total: files.length, files: files.slice(0, limit) }
}

/** First match with some context, JSON escapes flattened. */
const snippet = async file => {
  const out = await rg(['--no-ignore', '-o', '-i', '-m', '1', '-e', `.{0,80}${literal}.{0,80}`, file])
  return out
    .split('\n')[0]
    .replace(/\\[nt]/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

const show = path =>
  path.startsWith(`${root}/`) ? relative(root, path) : path.replace(home, '~')

const results = await Promise.all(stores.map(search))
const snippets = await Promise.all(
  results.map(({ files }) => Promise.all(files.map(f => f.snippet ?? snippet(f.file))))
)

const order = recent ? 'newest first' : 'most matching lines first'
console.log(`"${term}" in pi, cursor, claude (top ${limit} per store, ${order})`)
results.forEach(({ name, missing, total, files }, r) => {
  if (missing) return console.log(`\n${name}: no store at ${show(missing)}`)
  if (!total) return console.log(`\n${name}: no matches`)
  console.log(`\n${name}: ${total} file${total === 1 ? '' : 's'}`)
  files.forEach((f, i) => {
    const date = new Date(f.mtime).toISOString().slice(0, 10)
    console.log(`  ${String(f.count).padStart(4)}  ${date}  ${show(f.file)}`)
    if (snippets[r][i]) console.log(`        ${snippets[r][i]}`)
  })
})
