#!/usr/bin/env node
import { existsSync as exists_sync, readdirSync as readdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { dirname, extname, join, relative, sep } from 'node:path'

const root = process.cwd()
const app = join(root, 'apps/realness')
const scan = [app, join(root, '.pi')]
const skip = new Set(['node_modules', 'runtime', 'agent', 'dist', 'coverage', '.git'])
const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"]((?:\.\.\/){3,}[^'"]*)['"]/gm

/** @type {Map<string, { dir: string, root_alias: boolean }>} */
const packages = new Map()
/** @param {string} dir */
const package_of = dir => {
  if (packages.has(dir)) return packages.get(dir)
  const file = join(dir, 'package.json')
  const found = exists_sync(file)
    ? { dir, root_alias: Boolean(JSON.parse(read_file_sync(file, 'utf8')).imports?.['#root/*']) }
    : package_of(dirname(dir))
  packages.set(dir, found)
  return found
}
/** @param {string} parent @param {string} child */
const inside = (parent, child) => child === parent || child.startsWith(parent + sep)

const found = []
/** @param {string} directory */
const walk = directory => {
  for (const entry of readdir_sync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walk(path)
      continue
    }
    if (!['.js', '.vue'].includes(extname(path))) continue
    const own = package_of(directory)
    for (const match of read_file_sync(path, 'utf8').matchAll(pattern)) {
      const target = join(directory, match[1].split('?')[0])
      const use =
        own.root_alias && inside(own.dir, target)
          ? '#root/'
          : !inside(app, path) && inside(app, target)
            ? 'realness/'
            : null
      if (use) found.push(`${relative(root, path)}: ${match[1]} -> use ${use}`)
    }
  }
}
for (const directory of scan) if (exists_sync(directory)) walk(directory)
if (found.length) {
  process.stderr.write(`${found.length} deep relative import(s):\n${found.join('\n')}\n`)
  process.exit(1)
}
process.stdout.write('No deep relative imports\n')
