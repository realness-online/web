#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const work = join(root, 'work')
const pattern = process.argv.slice(2).join(' ').trim()

/** @param {string} text */
const to_regex = text => {
  try {
    return new RegExp(text, 'i')
  } catch {
    return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  }
}
const want = pattern ? to_regex(pattern) : null

const is_dir = path => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
const list = dir => (is_dir(dir) ? readdirSync(dir).sort() : [])
const npm_scripts = dir => {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return Object.keys(pkg.scripts ?? {})
  } catch {
    return []
  }
}

const skip = new Set(['node_modules', 'dist', 'coverage', 'artifacts'])
const subpackages = project_dir =>
  list(project_dir).filter(
    name =>
      !name.startsWith('.') &&
      !skip.has(name) &&
      existsSync(join(project_dir, name, 'package.json'))
  )

const projects = list(work).filter(name => is_dir(join(work, name)))
let shown = 0

for (const project of projects) {
  const project_dir = join(work, project)
  const tooling_path = join(project_dir, '.tooling.md')
  const tooling = existsSync(tooling_path)
    ? readFileSync(tooling_path, 'utf8')
    : null
  const places = ['', ...subpackages(project_dir)]

  if (!want) {
    const counts = places
      .map(sub => [sub || '.', npm_scripts(join(project_dir, sub)).length])
      .filter(([, count]) => count)
      .map(([sub, count]) => (sub === '.' ? `${count}` : `${sub} ${count}`))
    const flag = tooling ? '  [.tooling.md]' : ''
    console.log(
      `${project}${flag}  npm scripts: ${counts.join(', ') || 'none'}`
    )
    continue
  }

  const found = []
  for (const sub of places) {
    const base = join(project_dir, sub)
    const prefix = sub ? `${sub}/` : ''
    const npm = npm_scripts(base).filter(name => want.test(name))
    if (npm.length) found.push(`${sub ? `${sub} ` : ''}npm: ${npm.join(', ')}`)
    for (const folder of ['scripts', 'tools']) {
      const files = list(join(base, folder)).filter(name => want.test(name))
      if (files.length) found.push(`${prefix}${folder}/: ${files.join(', ')}`)
    }
  }
  const mentions = tooling
    ? tooling.split('\n').filter(line => want.test(line)).length
    : 0
  if (!found.length && !mentions) continue

  shown++
  const flag = mentions
    ? `  [.tooling.md: ${mentions} line${mentions === 1 ? '' : 's'}]`
    : ''
  console.log(`${project}${flag}`)
  for (const line of found) console.log(`  ${line}`)
}

if (want && !shown)
  console.log(`no match for ${want} in ${projects.length} work/ projects`)
