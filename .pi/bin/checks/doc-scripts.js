#!/usr/bin/env node
import { execFileSync as exec_file_sync } from 'node:child_process'
import { readFileSync as read_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const SKIPPED = /(^|\/)(CHANGELOG\.md$|vault\/|fixtures\/)/
const RUN = /npm (?:--prefix \S+ )?run ([a-z][\w:.-]*)/g

/**
 * Text outside fenced blocks marked `md`, which quote another project's notes.
 * @param {string} text
 */
export const own_text = text => text.replace(/^```md\n[\s\S]*?^```$/gm, '')

/**
 * Every `npm run <name>` in `docs` whose name no package defines.
 * @param {Record<string, string>} docs file path to text
 * @param {Set<string>} scripts
 */
export const missing_scripts = (docs, scripts) =>
  Object.entries(docs).flatMap(([file, text]) =>
    [...own_text(text).matchAll(RUN)]
      .map(([, name]) => name)
      .filter(name => !scripts.has(name))
      .map(name => `${file}: npm run ${name}`)
  )

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
  const tracked = glob =>
    exec_file_sync('git', ['-C', root, 'ls-files', glob], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const scripts = new Set(
    tracked('*package.json').flatMap(file =>
      Object.keys(JSON.parse(read_file_sync(join(root, file), 'utf8')).scripts ?? {})
    )
  )
  const docs = Object.fromEntries(
    tracked('*.md')
      .filter(file => !SKIPPED.test(file))
      .map(file => [file, read_file_sync(join(root, file), 'utf8')])
  )
  const missing = [...new Set(missing_scripts(docs, scripts))]
  for (const line of missing) process.stderr.write(`${line}\n`)
  process.stdout.write(`${Object.keys(docs).length} docs: ${missing.length} missing scripts\n`)
  process.exitCode = missing.length ? 1 : 0
}
