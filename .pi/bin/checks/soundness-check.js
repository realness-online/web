#!/usr/bin/env node
// A line carrying `soundness-allow: <reason>` (older `useless-allow` still works) excuses the hit on it, or the hit on

import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  statSync as stat_sync
} from 'node:fs'
import { dirname, join, parse, relative, resolve } from 'node:path'
import { check_site } from './site-check.js'

const root = process.cwd()

const SKIP = new Set([
  'node_modules',
  '.git',
  'artifacts',
  'vault',
  'dist',
  'coverage',
  '.obsidian',
  'sessions',
  '.agents',
  '.pi',
  '.claude',
  '.cursor',
  '.nuxt',
  '.output',
  '.next',
  '.svelte-kit',
  '.astro',
  '.vercel',
  '.netlify',
  'out',
  'wasm',
  '.cache',
  '.venv',
  'site-packages',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.turbo',
  '.vite',
  'tests',
  'specs',
  '__tests__'
])

const SOURCE = /\.(js|ts|vue|css|html|jsx|tsx)$/
const CODE = /\.(js|ts|jsx|tsx|vue)$/
const VUE = /\.vue$/
const NODE_IMPORT = /\.(js|ts)$/

const ALLOW = /(soundness|useless)-allow/

const remote_tags = [
  /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i,
  /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])(?=[^>]*\bhref\s*=\s*["']https?:)[^>]*>/i
]

const remote_imports = [/\bimport\s+[^;\n]*\bfrom\s+["']https?:\/\//, /\bimport\(\s*["']https?:\/\//]

const hits = (text, patterns) => {
  const found = []
  text.split('\n').forEach((line, i) => {
    if (ALLOW.test(line)) return
    if (patterns.some(re => re.test(line))) found.push({ line: i + 1, text: line.trim() })
  })
  return found
}

const nearest = (file, names) => {
  let dir = dirname(resolve(file))
  while (true) {
    for (const name of names) if (exists_sync(join(dir, name))) return join(dir, name)
    if (dir === root || dir === parse(dir).root) return null
    dir = dirname(dir)
  }
}

const package_json = file => nearest(file, ['package.json'])

const has_root_map = file => {
  const manifest = package_json(file)
  if (!manifest) return false
  const parsed = JSON.parse(read_file_sync(manifest, 'utf8'))
  return Boolean(parsed.imports?.['#root/*'])
}

const is_deno = file => Boolean(nearest(file, ['deno.lock', 'deno.json']))

const PROSE_RULES = [
  'module boundaries',
  'selector choice',
  'invented wrappers',
  'output escaping',
  'dependency choice',
  'markup over map'
]

const import_case_hits = text => {
  const found = []
  for (const match of text.matchAll(/^\s*import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from/gm)) {
    const line = text.slice(0, match.index).split('\n').length + (match[0].match(/^\s*/)[0].split('\n').length - 1)
    for (const part of match[1].split(',')) {
      const [name, alias] = part.trim().split(/\s+as\s+/)
      const bound = (alias ?? name)?.trim()
      if (bound && /^[a-z][a-z0-9]*[A-Z]/.test(bound)) found.push({ line, text: `${name.trim()} -> ${bound}` })
    }
  }
  return found
}

const strip_comments = text => {
  let out = ''
  let state = null
  let in_class = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (state === 'line') {
      out += ch === '\n' ? '\n' : ' '
      if (ch === '\n') state = null
      continue
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = null
        out += '  '
        i++
      } else out += ch === '\n' ? '\n' : ' '
      continue
    }
    if (state === 'regex') {
      if (ch === '\\') {
        out += '  '
        i++
        continue
      }
      if (ch === '[') in_class = true
      else if (ch === ']') in_class = false
      else if (ch === '/' && !in_class) state = null
      out += ch === '\n' ? '\n' : ' '
      continue
    }
    if (state) {
      if (ch === '\\') {
        out += '  '
        i++
        continue
      }
      if (ch === state) state = null
      out += ch === '\n' ? '\n' : ' '
      continue
    }
    if (ch === '/' && next === '/') {
      state = 'line'
      out += '  '
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      state = 'block'
      out += '  '
      i++
      continue
    }
    if (ch === '/' && !/[[\w$\])'"]/.test(out.trimEnd().at(-1) ?? '')) {
      state = 'regex'
      in_class = false
      out += ' '
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') state = ch
    out += ch
  }
  return out
}

const function_hits = text => {
  const original = text.split('\n')
  const found = []
  strip_comments(text)
    .split('\n')
    .forEach((line, i) => {
      if (ALLOW.test(original[i])) return
      if (/(?<!-)\bfunction\b(?!\s*\*)/.test(line)) found.push({ line: i + 1, text: original[i].trim() })
    })
  return found
}

const css_nesting_hits = text => {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const rules = []
  let depth = 0
  let start = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '{') {
      const raw = clean.slice(start, i).trim()
      if (depth === 0 && raw && !raw.startsWith('@')) {
        const line = clean.slice(0, i).split('\n').length
        for (const one of raw.split(',')) {
          const selector = one.trim()
          if (selector) rules.push({ selector, line, key: selector.split(/[\s>+~]+/)[0] })
        }
      }
      depth++
      start = i + 1
    } else if (ch === '}') {
      depth--
      start = i + 1
    }
  }
  const seen = new Map()
  const found = []
  for (const rule of rules) {
    if (!seen.has(rule.key)) {
      seen.set(rule.key, rule.selector)
      continue
    }
    if (seen.get(rule.key) === rule.selector) continue
    seen.set(rule.key, rule.selector)
    found.push({ line: rule.line, text: rule.selector })
  }
  return found
}

export const check_text = (file, text) => {
  const out = []
  const add = (rule, found) => found.forEach(hit => out.push({ rule, ...hit }))

  add('remote-asset', hits(text, remote_tags))
  if (!is_deno(file)) add('remote-asset', hits(text, remote_imports))

  if (NODE_IMPORT.test(file) && !has_root_map(file))
    add('root-import', hits(text, [/\bfrom\s+["']#root\//, /\bimport\(\s*["']#root\//, /^\s*import\s+["']#root\//m]))

  if (VUE.test(file)) {
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (ALLOW.test(line) || (i > 0 && ALLOW.test(lines[i - 1]))) return
      if (/<style[^>]*\bscoped\b/.test(line) || /<Transition(Group)?\b/.test(line))
        out.push({ rule: 'vue-scoping', line: i + 1, text: line.trim() })
    })
  }

  if (CODE.test(file) && !file.endsWith('.d.ts')) {
    add('function-keyword', function_hits(text))
    add('import-snake-case', import_case_hits(text))
  }
  if (/\.css$/.test(file)) add('css-nesting', css_nesting_hits(text))

  return out
}

const walk = (target, files) => {
  if (!exists_sync(target)) return
  const info = stat_sync(target)
  if (info.isDirectory()) {
    if (SKIP.has(parse(target).base)) return
    for (const entry of readdir_sync(target, { withFileTypes: true }))
      if (!entry.isDirectory() || !SKIP.has(entry.name)) walk(join(target, entry.name), files)
  } else if (SOURCE.test(target) && !/\.test\.(js|ts)$/.test(target)) {
    files.push(target)
  }
}

const is_minified = text => {
  let start = 0
  let line = text.indexOf('\n', start)
  while (line !== -1) {
    if (line - start > 1000) return true
    start = line + 1
    line = text.indexOf('\n', start)
  }
  return text.length - start > 1000
}

export const main = (argv = process.argv.slice(2)) => {
  if (argv.includes('--site')) {
    const index = argv.indexOf('--site')
    const directory = argv[index + 1]
    if (!directory || directory.startsWith('--')) {
      console.error('usage: node .pi/bin/checks/soundness-check.js --site <built-directory> [--worker <file>]')
      return 1
    }
    const worker_index = argv.indexOf('--worker')
    const options = worker_index < 0 ? {} : { worker: argv[worker_index + 1] }
    try {
      const hits = check_site(directory, options)
      for (const hit of hits) console.log(`${hit.file}  ${hit.rule}  ${hit.text}`)
      console.log(`soundness site: ${hits.length} hit(s); offline, updates, and rendered appearance need browser tests`)
      return hits.length ? 1 : 0
    } catch (error) {
      console.error(`soundness site: ${error.message}`)
      return 1
    }
  }
  const warn = argv.includes('--warn')
  const targets = argv.filter(arg => !arg.startsWith('--'))
  if (targets.length === 0) targets.push(root)

  const files = []
  for (const target of targets) walk(target, files)

  const violations = []
  for (const file of files) {
    const text = read_file_sync(file, 'utf8')
    if (/\.min\.(js|css)$/.test(file) || is_minified(text)) continue
    for (const hit of check_text(file, text)) violations.push({ file: relative(root, file), ...hit })
  }

  if (violations.length === 0) {
    console.log(`soundness: ${files.length} files clean`)
    console.log(`soundness: not checked (prose): ${PROSE_RULES.join(', ')}`)
    return 0
  }

  for (const v of violations) console.log(`${v.file}:${v.line}  ${v.rule}  ${v.text}`)
  console.log(`soundness: ${violations.length} hit(s) in ${files.length} files`)
  console.log(`soundness: not checked (prose): ${PROSE_RULES.join(', ')}`)
  return warn ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())
