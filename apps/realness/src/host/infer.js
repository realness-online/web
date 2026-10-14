import {
  existsSync as exists_sync,
  openSync as open_sync,
  readSync as read_sync,
  closeSync as close_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  statSync as stat_sync
} from 'node:fs'
import { join } from 'node:path'

const ELF_MAGIC = Buffer.from('7f454c46', 'hex')
const EXECUTABLE_BITS = 0o111

export const APP_PORT = 8080
export const HANDLER = 'server.js'
export const SERVE = '/opt/runtime/brayness/serve.js'
export const START = [
  'node',
  '--permission',
  '--allow-fs-read=/app/code/',
  '--allow-fs-read=/opt/runtime/brayness/',
  SERVE
]

const EXPORT =
  'brayness runs one fetch handler: export default { fetch(request) } from server.js'

export class InferError extends Error {}

const SPECIFIER =
  /(?:\bimport\s*(?:[\w*{}\s,]+from\s*)?|\bexport\s*[\w*{}\s,]+from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'`]([^"'`]+)["'`]/g
const SOURCE = /\.(js|mjs|cjs)$/
const MODULES = ['node', 'modules'].join('_')

function* walk(dir, rel = '') {
  for (const entry of readdir_sync(join(dir, rel), { withFileTypes: true })) {
    const path = join(rel, entry.name)
    if (entry.isDirectory()) {
      yield { path, dir: true }
      yield* walk(dir, path)
    } else if (entry.isFile()) yield { path, dir: false }
  }
}

/** Every reason the files reach past the standard library. */
export const outsideStdlib = dir => {
  const found = []
  for (const { path, dir: isDir } of walk(dir)) {
    if (isDir && path.split('/').pop() === MODULES)
      found.push(`${path}/: apps take no dependencies`)
    if (isDir || !SOURCE.test(path)) continue
    for (const [, spec] of read_file_sync(join(dir, path), 'utf8').matchAll(
      SPECIFIER
    )) {
      if (
        spec.startsWith('node:') ||
        spec.startsWith('./') ||
        spec.startsWith('../')
      )
        continue
      found.push(
        `${path} imports '${spec}': use node: built-ins and your own files`
      )
    }
  }
  const pkg = join(dir, 'package.json')
  if (exists_sync(pkg)) {
    let json = {}
    try {
      json = JSON.parse(read_file_sync(pkg, 'utf8'))
    } catch {}
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies'
    ]) {
      const names = Object.keys(json[field] ?? {})
      if (names.length) found.push(`package.json ${field}: ${names.join(', ')}`)
    }
  }
  return found
}

const isElf = path => {
  const fd = open_sync(path, 'r')
  try {
    const head = Buffer.alloc(ELF_MAGIC.length)
    return (
      read_sync(fd, head, 0, ELF_MAGIC.length, 0) === ELF_MAGIC.length &&
      head.equals(ELF_MAGIC)
    )
  } finally {
    close_sync(fd)
  }
}

/** Files that mean another stack; each is refused by name. */
const refusals = dir => {
  const found = []
  for (const name of readdir_sync(dir)) {
    const path = join(dir, name)
    const stat = stat_sync(path)
    if (!stat.isFile()) continue
    if (name === 'Procfile') found.push('a Procfile')
    else if (name.endsWith('.py')) found.push(`python (${name})`)
    else if (stat.mode & EXECUTABLE_BITS && isElf(path))
      found.push(`an executable (${name})`)
  }
  return found
}

/** What `dir` is: {kind, runtime, start, port}. Throws InferError, with the reason, otherwise. */
export const infer = dir => {
  const refused = refusals(dir)
  if (refused.length) throw new InferError(`${refused.join(', ')}: ${EXPORT}`)
  const handler = join(dir, HANDLER)
  if (exists_sync(handler)) {
    if (!/^\s*export\s+default\b/m.test(read_file_sync(handler, 'utf8')))
      throw new InferError(`${HANDLER} has no default export: ${EXPORT}`)
    const outside = outsideStdlib(dir)
    if (outside.length)
      throw new InferError(`standard library only:\n  ${outside.join('\n  ')}`)
    return { kind: 'handler', runtime: 'node', start: START, port: APP_PORT }
  }
  if (exists_sync(join(dir, 'index.html')))
    return { kind: 'site', runtime: null, start: null, port: null }
  throw new InferError(`no ${HANDLER} and no index.html: ${EXPORT}`)
}
