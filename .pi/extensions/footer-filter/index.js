/**
 * Footer: one line with the git branch, colored by status, then the thinking
 * level and model that answered, subscription or credits, the context fill,
 * and the Claude usage percent, and the bound plan at the end so the plan
 * name survives a narrow screen.
 *
 * Keys in `footer.hideStatuses` in the agent settings.json never show. The
 * Claude usage warning becomes a short percent on the footer line; other
 * statuses show on a second line.
 */
import { execFile as exec_file } from 'node:child_process'
import { readFileSync as read_file_sync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Status key that prewalk sets to the bound plan's name. */
export const PLAN_KEY = 'plan'

/** Event that carries `footer_parts` to other extensions each time they change. */
export const FOOTER_EVENT = 'footer:parts'

/** Status keys hidden when settings name none. */
export const DEFAULT_HIDDEN = ['claude-oauth-ready']

/** Status key of the Claude usage warning. */
export const USAGE_KEY = 'claude-oauth-issue'

/** Hidden status keys from settings, or the default list. */
export const hidden_keys = (
  settings_path = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'settings.json')
) => {
  try {
    const keys = JSON.parse(read_file_sync(settings_path, 'utf8')).footer?.hideStatuses
    return new Set(Array.isArray(keys) ? keys : DEFAULT_HIDDEN)
  } catch {
    return new Set(DEFAULT_HIDDEN)
  }
}

/** Makes a footer data provider drop hidden keys, now and on every later set. */
export const filter_provider = (provider, hidden) => {
  if (provider.footer_filter_applied) return
  const set = provider.setExtensionStatus.bind(provider)
  provider.setExtensionStatus = (key, text) => set(key, hidden.has(key) ? undefined : text)
  for (const key of hidden) set(key, undefined)
  provider.footer_filter_applied = true
}

/** Short usage text from the Claude usage warning, e.g. "wk 77%". */
export const usage_label = text => {
  if (!text) return null
  if (/hit your/i.test(text)) return { text: 'limit hit', level: 'error' }
  const match = text.match(/(\d+)% of your (\S+)/)
  if (!match) return null
  const percent = Number(match[1])
  const window = match[2] === 'weekly' ? 'wk' : '5h'
  return { text: `${window} ${percent}%`, level: percent >= 90 ? 'warning' : 'dim' }
}

/** Token count as 950, 24k, or 1.0M. */
export const tokens = count =>
  count >= 1_000_000
    ? `${(count / 1_000_000).toFixed(1)}M`
    : count >= 1000
      ? `${Math.round(count / 1000)}k`
      : `${count}`

/** Context fill as "7.9%/1.0M", with its color level. */
export const context_label = usage => {
  if (!usage) return null
  const percent = usage.percent ?? 0
  const text = `${usage.percent === null ? '?' : percent.toFixed(1)}%/${tokens(usage.contextWindow)}`
  return { text, level: percent > 90 ? 'error' : percent > 70 ? 'warning' : 'dim' }
}

const SELECTIONS = new Set(['model_change', 'thinking_level_change'])

/** Thinking level and model of the latest answer, unless a selection came after it. */
export const model_label = (entries, model, thinking) => {
  const index = entries.findLastIndex(entry => entry.type === 'message' && entry.message.role === 'assistant')
  const reselected = entries.slice(index + 1).some(entry => SELECTIONS.has(entry.type))
  const last = index < 0 || reselected ? undefined : entries[index].message
  const id = last?.responseModel ?? last?.model ?? model?.id ?? 'no model'
  const level = last?.thinkingLevel ?? thinking
  return model?.reasoning || last?.thinkingLevel ? `${level} · ${id}` : id
}

/** "sub" when the model runs on a subscription, else "credits". */
export const billing_label = (registry, model) => (model && registry?.isUsingOAuth(model) ? 'sub' : 'credits')

/** Left and right parts on one line of the given width; the left part loses its start first. */
export const fit = (left, right, width) => {
  const right_width = right.reduce((sum, part) => sum + part.text.length, 0) + 2 * (right.length - 1)
  const room = width - right_width - 2
  if (room < 1) return { left: '', gap: '', right }
  const shown = left.length > room ? `…${left.slice(left.length - room + 1)}` : left
  return { left: shown, gap: ' '.repeat(width - shown.length - right_width), right }
}

/** The bound plan and the git branch; either may be missing. */
export const place_label = (plan, branch) => [plan, branch && `(${branch})`].filter(Boolean).join(' ')

/** Branch color from `git status --porcelain`: clean is success, changes are warning. */
export const branch_level = porcelain => (porcelain === null ? 'dim' : porcelain.trim() ? 'warning' : 'success')

/**
 * What the footer shows, as plain values a terminal or a browser can draw.
 * @param {{ entries: any[], model: any, thinking: string, registry: any, context: any, statuses: Map<string, string>, branch: string | null, porcelain: string | null }} source
 * @returns {{ plan: string, branch: string | null, branch_level: string, parts: Array<{ text: string, level: string }> }}
 */
export const footer_parts = ({ entries, model, thinking, registry, context, statuses, branch, porcelain }) => ({
  plan: statuses.get(PLAN_KEY) ?? '',
  branch: branch ?? null,
  branch_level: branch_level(porcelain),
  parts: [
    { text: model_label(entries, model, thinking), level: 'dim' },
    { text: billing_label(registry, model), level: 'dim' },
    context_label(context),
    usage_label(statuses.get(USAGE_KEY))
  ].filter(Boolean)
})

/**
 * The left of the line in its two colours: the plan dim, the branch by its git
 * status. A left the fit cut through the branch takes the branch colour whole.
 * @param {string} text
 * @param {{ plan: string, branch: string | null, branch_level: string }} shown
 * @param {(level: string, text: string) => string} paint
 */
export const paint_place = (text, shown, paint) => {
  const branch = shown.branch ? `(${shown.branch})` : ''
  if (!text) return ''
  if (!branch || !text.endsWith(branch)) return paint(branch ? shown.branch_level : 'dim', text)
  const plan = text.slice(0, text.length - branch.length)
  return `${plan ? paint('dim', plan) : ''}${paint(shown.branch_level, branch)}`
}

/** The working tree's `git status --porcelain`, or null outside a repo. */
const git_status = cwd =>
  new Promise(done =>
    exec_file('git', ['status', '--porcelain'], { cwd, maxBuffer: 1 << 26 }, (error, out) => done(error ? null : out))
  )

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default pi => {
  let redraw = () => {}
  pi.on('model_select', () => redraw())
  pi.on('thinking_level_select', () => redraw())
  let porcelain = null
  let told = ''
  const refresh = async ctx => {
    porcelain = await git_status(ctx.sessionManager.getCwd())
    redraw()
  }
  pi.on('agent_end', (_event, ctx) => refresh(ctx))
  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return
    refresh(ctx)
    const hidden = hidden_keys()
    ctx.ui.setFooter((tui, theme, provider) => {
      filter_provider(provider, new Set([...hidden].filter(key => key !== USAGE_KEY)))
      const unsubscribe = provider.onBranchChange?.(() => refresh(ctx))
      redraw = () => tui.requestRender()
      const paint = part => theme.fg(part.level, part.text)
      return {
        dispose: unsubscribe,
        invalidate() {},
        render(width) {
          const statuses = provider.getExtensionStatuses()
          const shown = footer_parts({
            entries: ctx.sessionManager.getBranch(),
            model: ctx.model,
            thinking: pi.getThinkingLevel(),
            registry: ctx.modelRegistry,
            context: ctx.getContextUsage(),
            statuses,
            branch: provider.getGitBranch(),
            porcelain
          })
          const next = JSON.stringify(shown)
          if (next !== told) {
            told = next
            pi.events.emit(FOOTER_EVENT, shown)
          }
          const line = fit(place_label(shown.plan, shown.branch), shown.parts, width)
          const left = paint_place(line.left, shown, theme.fg)
          const right = line.right.map(paint).join('  ')
          const lines = [left + line.gap + right]
          const others = [...statuses]
            .filter(([key]) => key !== USAGE_KEY && key !== PLAN_KEY && !hidden.has(key))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => text)
          if (others.length) lines.push(others.join(' '))
          return lines
        }
      }
    })
  })
}
