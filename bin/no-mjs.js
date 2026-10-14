#!/usr/bin/env node
import { readdirSync as readdir_sync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const skip = new Set(['node_modules', '.git', 'work', 'vault', '.npm', '.auto', 'dist', 'coverage', ...(process.argv.includes('--all') ? [] : ['artifacts'])])
const forbidden = []
const commonjs = []
const typescript = new Set(['.ts', '.tsx', '.mts', '.cts'])
const walk = directory => {
  for (const entry of readdir_sync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const file = relative(root, path).replaceAll('\\', '/')
    if (entry.isDirectory()) {
      if (!skip.has(entry.name) && file !== '.pi/agent') walk(path)
    } else if (extname(file) === '.mjs' || (file.startsWith('.pi/') && typescript.has(extname(file)))) forbidden.push(file)
    else if (extname(file) === '.cjs') commonjs.push(file)
  }
}
walk(root)
if (commonjs.length) process.stdout.write(`${commonjs.length} .cjs file(s), correct where CommonJS is required:\n${commonjs.sort().join('\n')}\n`)
if (forbidden.length) {
  process.stderr.write(`Use .js with JSDoc; ${forbidden.length} forbidden source file(s):\n${forbidden.sort().join('\n')}\n`)
  process.exit(1)
}
process.stdout.write('No .mjs files or TypeScript source in .pi\n')
