/**
 * Files Extension
 *
 * `/files` (Ctrl+Shift+O) lists the files this session changed, then other
 * changes, then the rest of the git tree. Diff and open go to the running
 * Neovim through the server socket that `work/nvim` starts at
 * `artifacts/nvim/server.sock`. Ctrl+Shift+R shows the newest changed file in
 * Quick Look.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
/** @typedef {import('./changes.js').FileEntry} FileEntry */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import {
  changed_paths,
  diff_expr,
  file_entries,
  head_copy_path,
  open_expr,
  parse_status,
  with_mention
} from './changes.js'
import { pick_action, pick_file } from './picker.js'

const root = resolve(import.meta.dirname, '../../..')
const server_path = join(root, 'artifacts', 'nvim', 'server.sock')

/** @param {ExtensionAPI} pi */
export default pi => {
  /** @param {string[]} args */
  const git = async args => {
    const result = await pi.exec('git', args, { cwd: root })
    return result.code === 0 ? result.stdout : ''
  }

  /**
   * @param {any} ctx
   * @param {string} expr
   */
  const nvim = async (ctx, expr) => {
    if (!existsSync(server_path))
      return ctx.ui.notify(`Neovim is not running (no ${relative(root, server_path)})`, 'warning')
    const result = await pi.exec('nvim', ['--server', server_path, '--remote-expr', expr])
    if (result.code !== 0) ctx.ui.notify(result.stderr.trim() || 'Neovim did not respond', 'error')
  }

  /**
   * @param {any} ctx
   * @param {string} command
   * @param {string[]} args
   */
  const run = async (ctx, command, args) => {
    const result = await pi.exec(command, args)
    if (result.code !== 0) ctx.ui.notify(result.stderr.trim() || `${command} failed`, 'error')
  }

  /**
   * @param {any} ctx
   * @param {FileEntry} file
   */
  const diff = async (ctx, file) => {
    const head_copy = head_copy_path(root, file.path)
    mkdirSync(dirname(head_copy), { recursive: true })
    writeFileSync(head_copy, await git(['show', `HEAD:${relative(root, file.path)}`]))
    await nvim(ctx, diff_expr(file.path, head_copy))
  }

  /** @type {Record<string, (ctx: any, file: FileEntry) => Promise<void> | void>} */
  const actions = {
    diff,
    open: (ctx, file) => nvim(ctx, open_expr(file.path)),
    reveal: (ctx, file) => run(ctx, 'open', ['-R', file.path]),
    quicklook: (ctx, file) => run(ctx, 'qlmanage', ['-p', file.path]),
    app: (ctx, file) => run(ctx, 'open', [file.path]),
    prompt: (ctx, file) => ctx.ui.setEditorText(with_mention(ctx.ui.getEditorText(), relative(root, file.path)))
  }
  const action_items = [
    { value: 'diff', label: 'Diff in Neovim' },
    { value: 'open', label: 'Open in Neovim' },
    { value: 'reveal', label: 'Reveal in Finder' },
    { value: 'quicklook', label: 'Quick Look' },
    { value: 'app', label: 'Open with default app' },
    { value: 'prompt', label: 'Add to prompt' }
  ]

  /** @param {any} ctx */
  const browse = async ctx => {
    const session = changed_paths(ctx.sessionManager.getBranch(), ctx.cwd)
    const status = parse_status(root, await git(['status', '--porcelain=1', '-z']))
    const tree = (await git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']))
      .split('\0')
      .filter(Boolean)
      .map(path => join(root, path))
    const picked = await pick_file(ctx, file_entries(root, session, status, tree))
    if (!picked) return
    const action = picked.diff ? 'diff' : await pick_action(ctx, relative(root, picked.file.path), action_items)
    if (action) await actions[action](ctx, picked.file)
  }

  pi.registerCommand('files', {
    description: 'Browse session changes and the git tree; diff or open in the running Neovim',
    handler: (_args, ctx) => browse(ctx)
  })
  pi.registerShortcut('ctrl+shift+o', { description: 'Browse files', handler: browse })
  pi.registerShortcut('ctrl+shift+r', {
    description: 'Quick Look the newest changed file',
    handler: async ctx => {
      const [newest] = changed_paths(ctx.sessionManager.getBranch(), ctx.cwd)
      if (!newest) return ctx.ui.notify('No files changed in this session', 'info')
      await run(ctx, 'qlmanage', ['-p', newest])
    }
  })
}
