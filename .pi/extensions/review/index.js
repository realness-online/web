/**
 * Review Extension
 *
 * `/review` branches the session back before its first message, so a fresh
 * reviewer judges the change without the producer's reasoning. Targets: this
 * session's changes, all uncommitted changes, a commit, or a branch.
 * `/end-review` returns to where you were, with or without a summary of the
 * findings.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
/** @typedef {import('./prompts.js').ReviewTarget} ReviewTarget */
import { relative, resolve } from 'node:path'
import { changed_paths } from '../files/changes.js'
import { review_origin, review_prompt, summary_prompt } from './prompts.js'

const root = resolve(import.meta.dirname, '../../..')

/** @param {any} ctx */
const show_widget = ctx => {
  const active = review_origin(ctx.sessionManager.getBranch())
  ctx.ui.setWidget('review', active ? ['Review branch - /end-review to return'] : undefined)
}

/** @param {ExtensionAPI} pi */
export default pi => {
  /** @param {string[]} args */
  const git = async args => {
    const result = await pi.exec('git', args, { cwd: root })
    if (result.code !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
    return result.stdout.trim()
  }

  /**
   * @param {any} ctx
   * @param {string} args
   * @returns {Promise<ReviewTarget | undefined>}
   */
  const choose_target = async (ctx, args) => {
    const [mode, value] = args.trim().split(/\s+/)
    const chosen =
      mode ||
      { 'This session': 'session', Uncommitted: 'uncommitted', Commit: 'commit', Branch: 'branch' }[
        await ctx.ui.select('Review', ['This session', 'Uncommitted', 'Commit', 'Branch'])
      ]
    if (chosen === 'session') {
      const paths = changed_paths(ctx.sessionManager.getBranch(), ctx.cwd).map(path => relative(root, path))
      if (paths.length) return { type: 'session', paths }
      ctx.ui.notify('No files changed in this session', 'info')
    }
    if (chosen === 'uncommitted') return { type: 'uncommitted' }
    if (chosen === 'commit') {
      const sha = value || (await ctx.ui.input('Commit', 'HEAD'))
      if (sha) return { type: 'commit', sha: await git(['rev-parse', '--short', sha]) }
    }
    if (chosen === 'branch') {
      const branch = value || (await ctx.ui.input('Base branch', 'main'))
      if (branch) return { type: 'branch', branch, base: await git(['merge-base', 'HEAD', branch]) }
    }
  }

  pi.registerCommand('review', {
    description: 'Review a change in a fresh branch: /review [session | uncommitted | commit <sha> | branch <name>]',
    handler: async (args, ctx) => {
      if (review_origin(ctx.sessionManager.getBranch()))
        return ctx.ui.notify('Already reviewing. /end-review first.', 'warning')
      await ctx.waitForIdle()
      const target = await choose_target(ctx, args)
      if (!target) return

      if (!ctx.sessionManager.getLeafId()) pi.appendEntry('review-anchor', {})
      const origin = ctx.sessionManager.getLeafId()
      const first = ctx.sessionManager
        .getEntries()
        .find((/** @type {any} */ entry) => entry.type === 'message' && entry.message.role === 'user')
      if (first) {
        const moved = await ctx.navigateTree(first.id, { summarize: false, label: 'code-review' })
        if (moved.cancelled) return
        ctx.ui.setEditorText('')
      }
      pi.appendEntry('review-session', { origin })
      show_widget(ctx)
      pi.sendUserMessage(review_prompt(target))
    }
  })

  pi.registerCommand('end-review', {
    description: 'Leave the review branch and return to the work',
    handler: async (_args, ctx) => {
      const origin = review_origin(ctx.sessionManager.getBranch())
      if (!origin) return ctx.ui.notify('Not in a review branch', 'info')
      await ctx.waitForIdle()
      const choice = await ctx.ui.select('Finish review', ['Return and summarize', 'Return only'])
      if (!choice) return
      const summarize = choice === 'Return and summarize'
      const moved = await ctx.navigateTree(
        origin,
        summarize ? { summarize, customInstructions: summary_prompt, replaceInstructions: true } : { summarize }
      )
      if (moved.cancelled) return
      if (summarize && !ctx.ui.getEditorText().trim()) ctx.ui.setEditorText('Act on the review findings')
      show_widget(ctx)
    }
  })

  pi.on('session_start', (_event, ctx) => show_widget(ctx))
  pi.on('session_tree', (_event, ctx) => show_widget(ctx))
}
