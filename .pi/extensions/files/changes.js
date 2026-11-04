import { isAbsolute, join, relative, resolve } from 'node:path'

/**
 * Paths that `edit` or `write` changed in this session branch, newest first.
 * @param {any[]} entries
 * @param {string} cwd
 * @returns {string[]}
 */
export const changed_paths = (entries, cwd) => {
  /** @type {Map<string, string>} */
  const calls = new Map()
  /** @type {Map<string, number>} */
  const changed = new Map()
  for (const { type, message } of entries) {
    if (type !== 'message') continue
    if (message.role === 'assistant' && Array.isArray(message.content))
      for (const block of message.content)
        if (
          block.type === 'toolCall' &&
          ['edit', 'write'].includes(block.name) &&
          typeof block.arguments?.path === 'string'
        )
          calls.set(block.id, block.arguments.path)
    if (message.role === 'toolResult' && !message.isError && calls.has(message.toolCallId)) {
      const path = /** @type {string} */ (calls.get(message.toolCallId))
      changed.set(isAbsolute(path) ? path : resolve(cwd, path), message.timestamp ?? 0)
    }
  }
  return [...changed].sort((a, b) => b[1] - a[1]).map(([path]) => path)
}

/**
 * Git status codes by absolute path, from `git status --porcelain=1 -z`.
 * @param {string} root
 * @param {string} porcelain
 * @returns {Map<string, string>}
 */
export const parse_status = (root, porcelain) => {
  /** @type {Map<string, string>} */
  const status = new Map()
  const fields = porcelain.split('\0').filter(Boolean)
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2)
    status.set(join(root, fields[i].slice(3)), code.trim())
    if (code[0] === 'R' || code[0] === 'C') i++
  }
  return status
}

/**
 * @typedef {{ path: string, label: string, session: boolean, status?: string }} FileEntry
 */

/**
 * Session changes first, then other changes, then the rest of the tree.
 * @param {string} root
 * @param {string[]} session
 * @param {Map<string, string>} status
 * @param {string[]} tree
 * @returns {FileEntry[]}
 */
export const file_entries = (root, session, status, tree) => {
  const ordered = [...new Set([...session, ...status.keys(), ...tree])]
  return ordered.map(path => {
    const code = status.get(path)
    const tags = [session.includes(path) && 'session', code].filter(Boolean)
    const label = relative(root, path) + (tags.length ? ` [${tags.join(' ')}]` : '')
    return { path, label, session: session.includes(path), status: code }
  })
}

/**
 * Where the HEAD copy of a file goes for the diff.
 * @param {string} root
 * @param {string} path
 */
export const head_copy_path = (root, path) => join(root, 'artifacts', 'files-diff', relative(root, path))

/**
 * Vim expression that opens `path` in a new tab, diffed against `head_copy`.
 * @param {string} path
 * @param {string} head_copy
 */
export const diff_expr = (path, head_copy) =>
  `execute(['tabedit ' . fnameescape(${JSON.stringify(path)}), 'diffsplit ' . fnameescape(${JSON.stringify(head_copy)}), 'redraw!'])`

/**
 * Vim expression that opens `path` in a new tab.
 * @param {string} path
 */
export const open_expr = path => `execute(['tabedit ' . fnameescape(${JSON.stringify(path)}), 'redraw!'])`

/**
 * Prompt text with an `@path` mention added.
 * @param {string} current
 * @param {string} label
 */
export const with_mention = (current, label) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${label}`
