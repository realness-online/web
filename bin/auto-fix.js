#!/usr/bin/env node
import { execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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
 * The fixer a project chose for itself: Vite Plus where a project has `vp`
 * and a Vite config, ESLint only where an ESLint config exists and ESLint is
 * installed locally, nothing otherwise. Never downloads a tool.
 * @param {string} file absolute path
 * @returns {{ tool: string, bin: string, args: string[], cwd: string } | null}
 */
export const fixer_for = file => {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const vp = join(dir, 'node_modules/.bin/vp')
    if (exists_sync(vp) && exists_sync(join(dir, 'vite.config.js')))
      return { tool: 'vp', bin: vp, args: ['check', '--fix'], cwd: dir }
    if (ESLINT_CONFIGS.some(name => exists_sync(join(dir, name)))) {
      const eslint = join(dir, 'node_modules/.bin/eslint')
      return exists_sync(eslint)
        ? { tool: 'eslint', bin: eslint, args: ['--fix', '--no-error-on-unmatched-pattern'], cwd: dir }
        : null
    }
    if (exists_sync(join(dir, '.git')) || dirname(dir) === dir) return null
  }
}

/**
 * Group files by fixer and run each group once from its project root.
 * Exits non-zero when any fixer reports remaining problems.
 * @param {string[]} files
 */
export const run = files => {
  const groups = new Map()
  for (const file of files.map(path => resolve(path))) {
    const fixer = fixer_for(file)
    if (!fixer) continue
    const key = `${fixer.bin}\0${fixer.cwd}`
    if (!groups.has(key)) groups.set(key, { ...fixer, files: [] })
    groups.get(key).files.push(file)
  }
  let failed = false
  for (const { bin, args, cwd, files: group } of groups.values())
    try {
      exec_file_sync(bin, [...args, ...group], { cwd, stdio: 'inherit' })
    } catch {
      failed = true
    }
  return failed ? 1 : 0
}

if (import.meta.filename === resolve(process.argv[1] ?? ''))
  process.exitCode = run(process.argv.slice(2))
