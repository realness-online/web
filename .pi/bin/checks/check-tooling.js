#!/usr/bin/env node

import { execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync as exists_sync, readdirSync as readdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { repo_args } from '../lib/repo-git.js'

const skipped = new Set(['node_modules', '.git', 'artifacts', 'dist', 'build', 'coverage', 'vendor', '.pi'])
const read_json = path => JSON.parse(read_file_sync(path, 'utf8'))
const git = (root, args) => exec_file_sync('git', [...repo_args(root), ...args], { encoding: 'utf8' }).trim()

const find_notes = dir =>
  readdir_sync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory() && !skipped.has(entry.name)) return find_notes(path)
    return entry.isFile() && entry.name === '.tooling.md' ? [path] : []
  })

const package_dir = dir => {
  if (exists_sync(join(dir, 'package.json'))) return dir
  const parent = dirname(dir)
  return parent === dir ? null : package_dir(parent)
}

/** Check notes without running any documented command. */
export const check_notes = (file, root) => {
  const text = read_file_sync(file, 'utf8')
  const errors = []
  if (text.trimEnd().split('\n').length > 40) errors.push('over 40 lines')
  if (text.trim().split(/\s+/).length > 400) errors.push('over 400 words')
  const declared = text.match(/^Package: `([^`]+)`\.$/m)?.[1]
  const owner = declared ? resolve(root, declared) : package_dir(dirname(file))
  if (!owner || !exists_sync(join(owner, 'package.json'))) errors.push('missing command package')
  for (const match of text.matchAll(/`(npm [^`\n]+)`/g)) {
    const command = match[1]
    const prefix = command.match(/^npm --prefix (\S+) /)?.[1]
    const dir = prefix ? resolve(owner ?? root, prefix) : owner
    const name = command.match(/\brun ([\w:.-]+)/)?.[1] ?? (command === 'npm test' ? 'test' : null)
    if (!name) continue
    if (
      !dir ||
      !exists_sync(join(dir, 'package.json')) ||
      !Object.hasOwn(read_json(join(dir, 'package.json')).scripts ?? {}, name)
    )
      errors.push(`unknown script: ${command}`)
  }
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z]+:/i.test(target)) continue
    if (!exists_sync(resolve(dirname(file), decodeURIComponent(target)))) errors.push(`missing link: ${target}`)
  }
  return errors
}

/** Changed documented script definitions require review of their notes. */
export const check_drift = (root, notes) => {
  const changed = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z'])
    .split('\0')
    .filter(Boolean)
  const errors = []
  for (const path of changed) {
    if (!(path.endsWith('/package.json') || path === 'package.json')) continue
    for (const scope of notes) {
      if (changed.includes(relative(root, scope))) continue
      const text = read_file_sync(scope, 'utf8')
      const declared = text.match(/^Package: `([^`]+)`\.$/m)?.[1]
      const owner = declared ? resolve(root, declared) : package_dir(dirname(scope))
      if (!owner || relative(root, join(owner, 'package.json')) !== path) continue
      const versions = ['HEAD', ''].map(ref => {
        try {
          return JSON.parse(git(root, ['show', `${ref}:${path}`])).scripts ?? {}
        } catch {
          return {}
        }
      })
      const documented = [...text.matchAll(/`npm run ([\w:.-]+)/g)].map(match => match[1])
      if (text.includes('`npm test`')) documented.push('test')
      if (documented.some(name => versions[0][name] !== versions[1][name]))
        errors.push(`${path}: review and stage ${relative(root, scope)}`)
    }
  }
  return errors
}

export const check_tooling = root => {
  const notes = ['apps', 'work'].flatMap(dir => (exists_sync(join(root, dir)) ? find_notes(join(root, dir)) : []))
  const errors = notes.flatMap(file => check_notes(file, root).map(error => `${relative(root, file)}: ${error}`))
  errors.push(...check_drift(root, notes))
  return { count: notes.length, errors }
}

if (process.argv[1] && resolve(process.argv[1]) === file_url_to_path(import.meta.url)) {
  const root = resolve(process.argv[2] ?? file_url_to_path(new URL('../../..', import.meta.url)))
  const { count, errors } = check_tooling(root)
  for (const error of errors) console.error(error)
  console.log(`${count} tooling files: ${errors.length} errors`)
  process.exitCode = errors.length ? 1 : 0
}
