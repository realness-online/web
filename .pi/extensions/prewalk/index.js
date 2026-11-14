/**
 * Prewalk: the frontier model shapes and gates a plan, a cheap model works its nodes.
 *
 * Arms on the plan `/planning <name>` names, or else the first plan the session
 * edits, when it carries `- Gate 1: approved`. An edit to an approved plan takes
 * over from an edited plan that is unapproved, or idle while the edited one has an
 * active node; a named plan stays. Each
 * binding is announced. Reading a plan never arms it. The frontier works the plan's first node whole, so the pattern is set before
 * the cheap model takes over: once a node's spec passes, later nodes run cheap.
 * A failing spec returns that node to the frontier model. No active node, as at
 * a gate, means the frontier
 * model, as does an error turn on the cheap model. Each node entering and
 * leaving `active`, and each escalation, is an item in
 * `artifacts/prewalk/escalations.html`.
 *
 * /prewalk              - status
 * /prewalk <target>     - cheap model as provider/id
 * /prewalk off | on     - stop or resume routing this session
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { plans_path } from '../../bin/lib/harness-settings.js'
import { approved, nodes_in } from '../../bin/lib/plan-gates.js'
import { product_import } from '../../bin/lib/product.js'

const { item_html, read_items } = await product_import('items')
const root = resolve(import.meta.dirname, '../../..')

export const DEFAULT_TARGET = 'openrouter/deepseek/deepseek-v4.1-flash-1017'
const RUNNER =
  /^(npx )?(node( [\w=-]+)* --test\b|node [^ ]+\.(spec|test)\.js\b|vitest\b|vp test\b|npm test\b|npm( --prefix [^ ]+)? run test\b)/

/** @param {string} command */
export const is_spec_run = command =>
  command
    .split(/;|&&|\|\||\|/)
    .map(part => part.trim())
    .some(part => RUNNER.test(part))

/**
 * The model a turn should run on: the frontier sets the pattern on a plan's
 * first node, then the cheap model takes the rest.
 * @param {{ on: boolean, approved: boolean, active: string[], escalated: Set<string>, proven?: boolean }} state
 * @returns {'cheap' | 'frontier'}
 */
export const route = ({ on, approved, active, escalated, proven = false }) =>
  on && approved && proven && active.length > 0 && !active.some(id => escalated.has(id)) ? 'cheap' : 'frontier'

/**
 * The plan file a tool path names, or null outside the plans folder.
 * @param {unknown} path
 * @param {string} cwd
 * @param {string} plans
 */
export const plan_of = (path, cwd, plans) => {
  if (typeof path !== 'string') return null
  const file = isAbsolute(path) ? path : resolve(cwd, path)
  return file.endsWith('.md') && !relative(plans, file).startsWith('..') ? file : null
}

/**
 * The plan a `/planning <name>` prompt names: `<name>/index.md` or `<name>.md`
 * in the plans folder, else the one plan whose name holds `<name>`.
 * @param {string | undefined} prompt
 * @param {string} plans
 */
export const plan_named = (prompt, plans) => {
  const match = /^<skill name="planning"[\s\S]*?<\/skill>\n\n(\S+)/.exec(prompt ?? '')
  if (!match) return null
  const name = match[1].replace(/\.md$/, '').replace(/\/$/, '')
  const file_of = entry =>
    [join(plans, entry, 'index.md'), join(plans, `${entry.replace(/\.md$/, '')}.md`)].find(existsSync)
  const exact = file_of(name)
  if (exact) return exact
  const found = readdirSync(plans)
    .filter(entry => entry.toLowerCase().includes(name.toLowerCase()))
    .map(file_of)
    .filter(Boolean)
  return found.length === 1 ? found[0] : null
}

/**
 * Whether an edit to another plan takes prewalk over: the edited plan is
 * approved, and the bound one is not, or has no active node while it does.
 * @param {{ approved: boolean, active: string[] }} bound
 * @param {{ approved: boolean, active: string[] }} edited
 */
export const takes_over = (bound, edited) =>
  edited.approved && (!bound.approved || (!bound.active.length && edited.active.length > 0))

/** @param {string} file */
const plan_state = file => {
  const text = readFileSync(file, 'utf8')
  return { approved: approved(text), active: nodes_in(text, 'active') }
}

/** @param {{ provider: string, id: string } | undefined} model */
const name_of = model => (model ? `${model.provider}/${model.id}` : '')

/**
 * @param {ExtensionAPI} pi
 * @param {{ plans?: string, log?: string }} [where]
 */
export default (
  pi,
  { plans = join(root, plans_path(root)), log = join(root, 'artifacts/prewalk/escalations.html') } = {}
) => {
  let on = true
  let target = DEFAULT_TARGET
  /** @type {any} */
  let frontier = null
  /** @type {string | null} */
  let plan = null
  /** True when `/planning` named the plan, which no edit takes over. */
  let named = false
  let state = { approved: false, active: /** @type {string[]} */ ([]) }
  const escalated = new Set()
  /** @type {Map<string, string>} */
  const errors = new Map()
  const failed = new Set()
  /** @type {Map<string, Set<string>>} */
  const models = new Map()
  const verified = new Set()
  /** Plans whose log holds a node spec that passed; the frontier keeps a plan's work until then. */
  const proven = new Set()
  /** True while prewalk itself put this session on the cheap model. */
  let routed = false
  let nudge = 'none'

  /** @param {any} ctx */
  const session_of = ctx => ctx?.sessionManager?.getSessionId?.() ?? ''

  /**
   * @param {any} ctx
   * @param {string} node
   * @param {string} reason
   * @param {string} model
   */
  const record = (ctx, node, reason, model) => append(ctx, 'escalation', { node, reason, model })

  /**
   * @param {any} ctx
   * @param {'start' | 'escalation' | 'outcome'} kind
   * @param {Record<string, string>} fields
   */
  const append = (ctx, kind, fields) => {
    const at = new Date().toISOString()
    mkdirSync(dirname(log), { recursive: true })
    appendFileSync(
      log,
      item_html(`prewalk/${kind}`, {
        plan: relative(root, plan ?? ''),
        session: session_of(ctx),
        ...fields,
        at
      }).replace('itemscope', `itemscope itemid="/prewalk/${kind}s/${fields.node}/${at}"`)
    )
  }

  /** Whether this plan's log already holds a passing spec, so a later session keeps its nodes cheap. */
  const proven_plan = () => {
    const key = relative(root, plan ?? '')
    if (proven.has(key)) return true
    if (!existsSync(log)) return false
    if (
      !read_items(readFileSync(log, 'utf8'), 'prewalk/outcome').some(
        item => item.plan === key && item.spec === 'passed'
      )
    )
      return false
    proven.add(key)
    return true
  }

  /** @param {any} ctx */
  const read_plan = ctx => {
    if (!plan || !existsSync(plan)) return
    const text = readFileSync(plan, 'utf8')
    const active = nodes_in(text, 'active')
    const blocked = nodes_in(text, 'blocked')
    for (const id of active.filter(id => !state.active.includes(id)))
      append(ctx, 'start', { node: id, model: name_of(ctx.model) })
    for (const id of state.active.filter(id => !active.includes(id))) {
      if (!blocked.includes(id) && !verified.has(id)) {
        record(ctx, id, 'finished without a passing spec', name_of(ctx.model))
        ctx.ui.notify(`Prewalk: ${id} finished without a passing spec`, 'warning')
      }
      if (verified.has(id)) proven.add(relative(root, plan ?? ''))
      append(ctx, 'outcome', {
        node: id,
        status: blocked.includes(id) ? 'blocked' : 'done',
        models: [...(models.get(id) ?? [])].join(', '),
        spec: verified.has(id) ? 'passed' : failed.has(id) ? 'failed' : 'none',
        escalated: escalated.has(id) ? 'yes' : 'no'
      })
      escalated.delete(id)
      verified.delete(id)
      failed.delete(id)
      errors.delete(id)
      models.delete(id)
    }
    if (active.length) nudge = 'none'
    state = { approved: approved(text), active }
  }

  /**
   * @param {string} file
   * @param {any} ctx
   */
  const bind = (file, ctx) => {
    const moved = file !== plan
    if (moved) state = { approved: false, active: [] }
    plan = file
    read_plan(ctx)
    if (moved)
      ctx.ui.notify(
        `Prewalk: bound to ${relative(plans, file)}${state.approved ? ' (Gate 1 approved)' : ', no Gate 1 approval, frontier only'}`,
        'info'
      )
  }

  pi.on('before_agent_start', (event, ctx) => {
    const file = plan_named(event.prompt, plans)
    if (file) {
      named = true
      bind(file, ctx)
    }
  })

  pi.on('tool_result', (event, ctx) => {
    if (!on) return
    const file = ['read', 'edit', 'write'].includes(event.toolName) && plan_of(event.input?.path, ctx.cwd, plans)
    if (file) {
      if (file === plan) read_plan(ctx)
      else if (event.toolName !== 'read' && (!plan || (!named && takes_over(state, plan_state(file))))) bind(file, ctx)
      return
    }
    const working = ['edit', 'write'].includes(event.toolName) && plan && state.approved && !state.active.length
    if (working && nudge === 'none') nudge = 'due'
    if (event.toolName !== 'bash') return
    if (!state.active.length || !is_spec_run(String(event.input?.command ?? ''))) return read_plan(ctx)
    for (const id of state.active) {
      if (!event.isError) {
        verified.add(id)
        failed.delete(id)
      } else failed.add(id)
      if (event.isError && !escalated.has(id)) {
        verified.delete(id)
        escalated.add(id)
        record(ctx, id, 'spec failed', name_of(ctx.model))
      }
    }
  })

  pi.on('turn_end', async (event, ctx) => {
    const current = name_of(ctx.model)
    for (const id of state.active) models.set(id, (models.get(id) ?? new Set()).add(current))
    if (on && routed && current === target && event.message?.stopReason === 'error') {
      const error = event.message.errorMessage || 'unknown error'
      for (const id of state.active.filter(id => !escalated.has(id))) {
        escalated.add(id)
        errors.set(id, error)
        record(ctx, id, `model error: ${error}`, current)
      }
    }
    const want = route({ on, ...state, escalated, proven: proven_plan() })
    if (nudge === 'due' && want === 'frontier') {
      nudge = 'sent'
      return {
        entries: [
          ...event.entries,
          {
            type: 'custom_message',
            customType: 'prewalk',
            display: false,
            content: `Prewalk: you are changing files for ${relative(root, plan ?? '')} with no active node. If this is node work, mark the node \`active\` in the plan now, before the next change.`
          }
        ]
      }
    }
    if (want === 'cheap' && current !== target) {
      const [provider, ...rest] = target.split('/')
      const model = ctx.modelRegistry.find(provider, rest.join('/'))
      if (!model) {
        ctx.ui.notify(`Prewalk: model "${target}" not found; routing off`, 'error')
        on = false
        return
      }
      frontier = ctx.model
      if (!(await pi.setModel(model))) return
      routed = true
      ctx.ui.notify(`Prewalk: ${state.active.join(', ')} on ${target}`, 'info')
      return {
        entries: [
          ...event.entries,
          {
            type: 'custom_message',
            customType: 'prewalk',
            display: false,
            content:
              `Prewalk: you now work node ${state.active.join(', ')} of ${relative(root, plan ?? '')} on a cheaper model. ` +
              "After each change, run the node's own spec. If it fails, stop and report the failure; never loosen the test. " +
              'Mark the node done only after its spec passes.'
          }
        ]
      }
    }
    if (want === 'frontier' && routed && frontier && current === target) {
      if (!(await pi.setModel(frontier))) return
      routed = false
      const failed = state.active.filter(id => escalated.has(id))
      ctx.ui.notify(`Prewalk: back to ${name_of(frontier)}${failed.length ? ` for ${failed.join(', ')}` : ''}`, 'info')
      if (!failed.length) return
      const errored = failed.filter(id => errors.has(id))
      const content = errored.length
        ? `Prewalk: the cheaper model failed on ${errored.join(', ')}: ${errors.get(errored[0])}. You take this node over from where it stopped.`
        : `Prewalk: the spec failed on ${failed.join(', ')} under the cheaper model. You take this node over; find the cause before changing the test.`
      return {
        entries: [
          ...event.entries,
          {
            type: 'custom_message',
            customType: 'prewalk',
            display: false,
            content
          }
        ]
      }
    }
  })

  pi.on('session_start', () => {
    on = true
    routed = false
    frontier = null
    plan = null
    state = { approved: false, active: [] }
    nudge = 'none'
    escalated.clear()
    verified.clear()
    proven.clear()
    errors.clear()
    failed.clear()
    models.clear()
  })

  pi.registerCommand('prewalk', {
    description: 'Cheap model works approved plan nodes. /prewalk [provider/id | off | on]',
    handler: async (args, ctx) => {
      const arg = args?.trim() ?? ''
      if (arg === 'off' || arg === 'on') on = arg === 'on'
      else if (arg) {
        target = arg
        routed = false
      }
      const where = plan
        ? `${relative(root, plan)}, ${state.approved ? 'approved' : 'not approved'}`
        : 'no plan read yet'
      ctx.ui.notify(
        `Prewalk ${on ? 'on' : 'off'}: ${target}; ${where}; active ${state.active.join(', ') || 'none'}`,
        'info'
      )
    }
  })
}
