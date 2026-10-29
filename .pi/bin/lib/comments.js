/**
 * Comment detection shared by the sweep and the guard.
 *
 * @param {string} text - source text
 * @param {string} ext - file extension, dot included
 * @returns {{start: number, end: number, keep: boolean}[]} comment ranges
 */

import { harness_require as require } from './harness-dependencies.js'
let parser = null
let vue_parse = null
try {
  parser = require('@babel/parser')
} catch {}
try {
  vue_parse = require('@vue/compiler-sfc').parse
} catch {}

const KEEP_PATTERNS = [
  /^\s*eslint-(disable|enable|env)/,
  /^\s*(oxlint|biome|fallow)-ignore/,
  /^\s*(tslint|deno-lint)[-:](ignore|disable)/,
  /^\s*@ts-(check|nocheck|ignore|expect-error|self-types)/,
  /^\s*@jsx/,
  /^\s*@vue-(ignore|expect-error|generic)/,
  /vite-ignore/,
  /webpackChunkName|webpackIgnore|webpackInclude/,
  /^\s*@?sourceMappingURL=/,
  /^\s*(@license|@preserve|@generated|@cc_on)/,
  /^\s*\/\*\s*globals?\b/,
  /DO NOT EDIT/,
  /istanbul ignore|c8 ignore|v8 ignore/,
  /^\s*prettier-ignore/,
  /^\s*(shellcheck|stylua:|luacheck|stylelint|htmlhint)/,
  /^\s*@vitest-environment/,
  /^\s*#?region\b|^\s*#?endregion\b/,
  /^\/{2,}\s*<reference\b/,
  /soundness-allow:/,
  /^\s*@flow\b/,
  /^\s*@jest-environment/
]

const keep_comment = (raw, lang) => {
  if (lang === 'lua' && raw.startsWith('---')) return true
  if (lang === 'rust' && (raw.startsWith('///') || raw.startsWith('//!'))) return true
  if (/^\/\*\*(?!\/)/.test(raw)) return true
  if (/^\/\*!/.test(raw)) return true
  const body = raw.replace(/^\s*(\/\/+|#+|-+|<!--|\/\*+|\*\/?)+/, '').trim()
  if (lang === 'py' && /^(type:|noqa|pylint:|fmt:|pyright:|mypy:|ruff:)/.test(body)) return true
  return KEEP_PATTERNS.some(pattern => pattern.test(raw) || pattern.test(body))
}

const DOCUMENTED = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'VariableDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'ObjectProperty',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
  'ClassProperty',
  'ClassPrivateProperty',
  'ClassAccessorProperty',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSPropertySignature',
  'TSMethodSignature',
  'TSDeclareFunction'
])

const FUNCTIONS = new Set(['FunctionExpression', 'ArrowFunctionExpression'])

/**
 * A statement that assigns, registers, or returns a function documents that
 * function: `exports.x = ...`, `describe('...', () => {})`, `return async () => {}`.
 * @param {{type: string, expression?: any, argument?: any}} node
 */
const hands_on_a_function = node => {
  const value =
    node.type === 'ExpressionStatement' ? node.expression : node.type === 'ReturnStatement' ? node.argument : null
  if (!value) return false
  const call = value.type === 'AwaitExpression' ? value.argument : value
  if (call?.type === 'AssignmentExpression') return true
  if (FUNCTIONS.has(call?.type)) return true
  return call?.type === 'CallExpression' && call.arguments.some(arg => FUNCTIONS.has(arg.type))
}

/**
 * Start offsets of every node a doc comment can describe: declarations,
 * properties, functions, and assignments such as `exports.name = ...`.
 * @param {object} ast
 * @returns {Set<number>}
 */
const documented_starts = ast => {
  const starts = new Set()
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node.type !== 'string') return
    if (DOCUMENTED.has(node.type) || hands_on_a_function(node)) starts.add(node.start)
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'comments' || key === 'leadingComments' || key === 'trailingComments') continue
      const value = node[key]
      if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast.program)
  return starts
}

/**
 * A `/**` block is JSDoc when it carries a tag, opens the file, or sits
 * directly above something it documents. Anywhere else it is a plain comment.
 * @param {string} text
 * @param {{start: number, end: number}} comment
 * @param {{start: number}[]} comments
 * @param {Set<number>} starts
 * @param {number} first_code
 */
const is_jsdoc = (text, comment, comments, starts, first_code) => {
  const raw = text.slice(comment.start, comment.end)
  if (/(^|\s)@[a-zA-Z]/.test(raw)) return true
  if (comment.start < first_code) return true
  let next = comment.end
  for (;;) {
    while (/\s/.test(text[next] ?? '')) next++
    const stacked = comments.find(other => other.start === next)
    if (!stacked) break
    next = stacked.end
  }
  return starts.has(next)
}

const js_ranges = (text, lang, base = 0) => {
  if (!parser) return []
  const plugins = ['jsx']
  if (lang === 'ts' || lang === 'tsx') plugins.push('typescript')
  const ast = parser.parse(text, { sourceType: 'unambiguous', plugins, attachComment: false, errorRecovery: true })
  const comments = ast.comments || []
  const starts = documented_starts(ast)
  const first_code = ast.program.body[0]?.start ?? text.length
  return comments.map(comment => {
    const raw = text.slice(comment.start, comment.end)
    const doc = /^\/\*\*(?!\/)/.test(raw)
    const keep = doc ? is_jsdoc(text, comment, comments, starts, first_code) : keep_comment(raw, 'js')
    return { start: base + comment.start, end: base + comment.end, keep }
  })
}

const css_ranges = (text, lang, base = 0) => {
  const ranges = []
  const line_ok = lang === 'styl' || lang === 'scss'
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'") {
      const quote = c
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      ranges.push({ start: base + i, end: base + stop, keep: keep_comment(text.slice(i, stop), 'css') })
      i = stop - 1
      continue
    }
    if (line_ok && c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      ranges.push({ start: base + i, end: base + stop, keep: keep_comment(text.slice(i, stop), 'css') })
      i = stop - 1
    }
  }
  return ranges
}

/**
 * End offset of a shell script's header: the block of `#` lines that opens
 * the file, after any shebang. The header documents the script.
 * @param {string} text
 * @returns {number}
 */
const sh_header_end = text => {
  let at = text.startsWith('#!') ? text.indexOf('\n') + 1 : 0
  if (at === 0 && text.startsWith('#!')) return text.length
  for (;;) {
    if (text[at] !== '#') return at
    const eol = text.indexOf('\n', at)
    if (eol === -1) return text.length
    at = eol + 1
  }
}

const sh_ranges = (text, base = 0) => {
  const ranges = []
  const header_end = sh_header_end(text)
  let i = 0
  let heredoc = null
  while (i < text.length) {
    if (heredoc) {
      const eol = text.indexOf('\n', i)
      const line = text.slice(i, eol === -1 ? text.length : eol)
      const probe = heredoc.strip_tabs ? line.replace(/^\t+/, '') : line
      if (probe === heredoc.delim) heredoc = null
      if (eol === -1) break
      i = eol + 1
      continue
    }
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === "'") {
      i++
      while (i < text.length && text[i] !== "'") i++
      i++
      continue
    }
    if (c === '"') {
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '<' && text[i + 1] === '<' && text[i + 2] !== '<') {
      let j = i + 2
      const strip_tabs = text[j] === '-'
      if (strip_tabs) j++
      while (text[j] === ' ' || text[j] === '\t') j++
      const quote = text[j] === "'" || text[j] === '"' ? text[j++] : ''
      let delim = ''
      while (j < text.length && /[\w.-]/.test(text[j])) {
        delim += text[j]
        j++
      }
      if (quote && text[j] === quote) j++
      if (delim) {
        heredoc = { delim, strip_tabs }
        i = j
        continue
      }
    }
    if (c === '#' && i === 0 && text[1] === '!') {
      const eol = text.indexOf('\n', i)
      const stop = eol === -1 ? text.length : eol
      ranges.push({ start: base + i, end: base + stop, keep: true })
      i = stop
      continue
    }
    if (c === '#' && (i === 0 || /[\s;&|()]/.test(text[i - 1]))) {
      const eol = text.indexOf('\n', i)
      const stop = eol === -1 ? text.length : eol
      ranges.push({
        start: base + i,
        end: base + stop,
        keep: i < header_end || keep_comment(text.slice(i, stop), 'sh')
      })
      i = stop
      continue
    }
    i++
  }
  return ranges
}

const line_ranges = (text, lang, marker, base = 0) => {
  const ranges = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (lang === 'py' && (text.startsWith('"""', i) || text.startsWith("'''", i))) {
      const close = text.slice(i, i + 3)
      const end = text.indexOf(close, i + 3)
      i = end === -1 ? text.length : end + 3
      continue
    }
    if (c === '"' || c === "'") {
      const quote = c
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === marker) {
      const nl = text.indexOf('\n', i)
      const stop = nl === -1 ? text.length : nl
      const shebang = marker === '#' && i === 0 && text[1] === '!'
      ranges.push({ start: base + i, end: base + stop, keep: shebang || keep_comment(text.slice(i, stop), lang) })
      i = stop
      continue
    }
    i++
  }
  return ranges
}

const lua_ranges = (text, base = 0) => {
  const ranges = []
  let i = 0
  const long_bracket = pos => {
    const m = /^\[(=*)\[/.exec(text.slice(pos))
    return m ? { len: m[0].length, eq: m[1] } : null
  }
  const read_long = (pos, eq) => {
    const close = ']' + eq + ']'
    const end = text.indexOf(close, pos)
    return end === -1 ? text.length : end + close.length
  }
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'") {
      const quote = c
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    const lb = c === '[' ? long_bracket(i) : null
    if (lb) {
      i = read_long(i + lb.len, lb.eq)
      continue
    }
    if (c === '-' && text[i + 1] === '-') {
      const opener = long_bracket(i + 2)
      if (opener) {
        const stop = read_long(i + 2 + opener.len, opener.eq)
        ranges.push({ start: base + i, end: base + stop, keep: keep_comment(text.slice(i, stop), 'lua') })
        i = stop
        continue
      }
      const nl = text.indexOf('\n', i)
      const stop = nl === -1 ? text.length : nl
      ranges.push({ start: base + i, end: base + stop, keep: keep_comment(text.slice(i, stop), 'lua') })
      i = stop
      continue
    }
    i++
  }
  return ranges
}

const clike_ranges = (text, lang, base = 0) => {
  const ranges = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (lang === 'rust' && /^(?:b?r)(#*)"/.test(text.slice(i))) {
      const m = /^(?:b?r)(#*)"/.exec(text.slice(i))
      const close = '"' + m[1]
      const end = text.indexOf(close, i + m[0].length)
      i = end === -1 ? text.length : end + close.length
      continue
    }
    if (c === '"') {
      i++
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (lang === 'rust' && c === "'" && /^(?:'\\.'|'.')/.test(text.slice(i))) {
      i += text.slice(i).startsWith("'\\") ? 4 : 3
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      const stop = nl === -1 ? text.length : nl
      ranges.push({ start: base + i, end: base + stop, keep: keep_comment(text.slice(i, stop), lang) })
      i = stop
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      let depth = 1
      let j = i + 2
      while (j < text.length && depth > 0) {
        if (lang === 'rust' && text[j] === '/' && text[j + 1] === '*') {
          depth++
          j += 2
          continue
        }
        if (text[j] === '*' && text[j + 1] === '/') {
          depth--
          j += 2
          continue
        }
        j++
      }
      ranges.push({ start: base + i, end: base + j, keep: keep_comment(text.slice(i, j), lang) })
      i = j
      continue
    }
    i++
  }
  return ranges
}

const html_ranges = (text, base = 0) => {
  const ranges = []
  const re = /<!--[\s\S]*?-->/g
  let m
  while ((m = re.exec(text)))
    ranges.push({ start: base + m.index, end: base + m.index + m[0].length, keep: keep_comment(m[0], 'html') })
  return ranges
}

const vue_ranges = text => {
  if (!vue_parse) return []
  const { descriptor } = vue_parse(text, { filename: 'x.vue' })
  const ranges = []
  const blocks = [descriptor.template, descriptor.script, descriptor.scriptSetup, ...descriptor.styles].filter(Boolean)
  const covered = blocks.map(block => [block.loc.start.offset, block.loc.end.offset]).sort((a, b) => a[0] - b[0])
  let cursor = 0
  for (const [start, end] of covered) {
    if (start > cursor) ranges.push(...html_ranges(text.slice(cursor, start), cursor))
    cursor = Math.max(cursor, end)
  }
  if (cursor < text.length) ranges.push(...html_ranges(text.slice(cursor), cursor))
  for (const block of blocks) {
    const start = block.loc.start.offset
    const body = text.slice(start, block.loc.end.offset)
    if (block === descriptor.template) ranges.push(...html_ranges(body, start))
    else if (block === descriptor.script || block === descriptor.scriptSetup) {
      const lang = block.lang === 'tsx' ? 'tsx' : block.lang === 'ts' ? 'ts' : 'js'
      ranges.push(...js_ranges(body, lang, start))
    } else {
      const lang = block.lang === 'stylus' || block.lang === 'styl' ? 'styl' : block.lang === 'scss' ? 'scss' : 'css'
      ranges.push(...css_ranges(body, lang, start))
    }
  }
  return ranges
}

export const comment_ranges = (text, ext) => {
  if (ext === '.vue') return vue_ranges(text)
  if (ext === '.lua') return lua_ranges(text)
  if (ext === '.styl') return css_ranges(text, 'styl')
  if (ext === '.css') return css_ranges(text, 'css')
  if (ext === '.scss') return css_ranges(text, 'scss')
  if (ext === '.sh' || ext === '.bash' || ext === '.zsh') return sh_ranges(text)
  if (ext === '.py') return line_ranges(text, 'py', '#')
  if (ext === '.rs') return clike_ranges(text, 'rust')
  if (ext === '.html') return html_ranges(text)
  const lang = ext === '.ts' ? 'ts' : ext === '.tsx' ? 'tsx' : ext === '.jsx' ? 'jsx' : 'js'
  return js_ranges(text, lang)
}

export const has_parser = () => Boolean(parser && vue_parse)
