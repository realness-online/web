#!/usr/bin/env node
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync, statSync as stat_sync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(exec_file)

const CODE = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.cjs', '.mjs'])
const TEXT = new Set(['.json', '.md', '.css', '.scss', '.styl', '.yml', '.yaml', '.html'])
const PYTHON = new Set(['.py'])
const IGNORED = ['/node_modules/', '/dist/', '/build/', '/.git/', '/coverage/']

const ESLINT_CONFIGS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml'
]

/**
 * Nearest project above a file that has Vite Plus installed and configured.
 * @param {string} file absolute path
 * @returns {string | null}
 */
const vp_root = file => {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (exists_sync(join(dir, 'node_modules/.bin/vp')) && exists_sync(join(dir, 'vite.config.js'))) return dir
    if (exists_sync(join(dir, '.git')) || dirname(dir) === dir) return null
  }
}

/**
 * The fixer a project chose for itself. Code gets `vp check --fix` where a
 * project has Vite Plus, else its own installed ESLint. Text gets `vp fmt`.
 * Python gets ruff. Nothing otherwise, and never a downloaded formatter.
 * @param {string} file absolute path
 * @returns {{ tool: string, cwd: string, steps: [string, string[]][] } | null}
 */
export const fixer_for = file => {
  const ext = extname(file).toLowerCase()
  if (PYTHON.has(ext))
    return {
      tool: 'ruff',
      cwd: dirname(file),
      steps: [
        ['uvx', ['ruff', 'check', '--fix', '--quiet']],
        ['uvx', ['ruff', 'format', '--quiet']]
      ]
    }
  if (!CODE.has(ext) && !TEXT.has(ext)) return null
  const vp = vp_root(file)
  if (vp) {
    const bin = join(vp, 'node_modules/.bin/vp')
    const args = CODE.has(ext) ? ['check', '--fix'] : ['fmt', '--write', '--no-error-on-unmatched-pattern']
    return { tool: CODE.has(ext) ? 'vp' : 'vp fmt', cwd: vp, steps: [[bin, args]] }
  }
  if (!CODE.has(ext)) return null
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (ESLINT_CONFIGS.some(name => exists_sync(join(dir, name)))) {
      const eslint = join(dir, 'node_modules/.bin/eslint')
      return exists_sync(eslint)
        ? { tool: 'eslint', cwd: dir, steps: [[eslint, ['--fix', '--no-error-on-unmatched-pattern']]] }
        : null
    }
    if (exists_sync(join(dir, '.git')) || dirname(dir) === dir) return null
  }
}

const mtime = file => {
  try {
    return stat_sync(file).mtimeMs
  } catch {
    return -1
  }
}

/**
 * Group files by fixer and run each group once from its project root.
 * A fixer that exits non-zero but rewrote files still counts as working.
 * @param {string[]} files
 * @returns {Promise<{ total: number, changed: string[], failed: string[] }>}
 */
export const fix = async files => {
  const groups = new Map()
  for (const file of files.map(path => resolve(path))) {
    if (!exists_sync(file) || IGNORED.some(part => file.includes(part))) continue
    const fixer = fixer_for(file)
    if (!fixer) continue
    const key = `${fixer.tool}\0${fixer.cwd}`
    if (!groups.has(key)) groups.set(key, { ...fixer, files: [] })
    groups.get(key).files.push(file)
  }
  const changed = []
  const failed = []
  let total = 0
  for (const { tool, cwd, steps, files: group } of groups.values()) {
    total += group.length
    const before = new Map(group.map(file => [file, mtime(file)]))
    let ok = true
    for (const [bin, args] of steps)
      try {
        await exec(bin, [...args, ...group], { cwd, maxBuffer: 16 * 1024 * 1024 })
      } catch {
        ok = false
      }
    const rewrote = group.filter(file => mtime(file) !== before.get(file))
    changed.push(...rewrote)
    if (!ok && !rewrote.length) failed.push(`${tool} (${group.length})`)
  }
  return { total, changed, failed }
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const { failed } = await fix(process.argv.slice(2))
  if (failed.length) console.error(`auto-fix failed: ${failed.join(', ')}`)
  process.exitCode = failed.length ? 1 : 0
}
