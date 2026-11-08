/**
 * Prewalk: the frontier model shapes and gates a plan, a cheap model works its nodes.
 *
 * Arms on its own once a plan under the plans folder carries `- Gate 1: approved`.
 * A node marked `active` runs on the cheap model; a failing spec returns that
 * node to the frontier model. No active node, as at a gate, means the frontier
 * model, as does an error turn on the cheap model. Each escalation, and each node leaving `active`, is an item in `vault/Prewalk/escalations.html`.
 *
 * /prewalk              - status
 * /prewalk <target>     - cheap model as provider/id
 * /prewalk off | on     - stop or resume routing this session
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { plans_ignore, plans_path } from '../../bin/lib/harness-settings.js'
import { approved, nodes_in } from '../../bin/lib/plan-gates.js'
import { plan_files } from '../../bin/lib/plan-files.js'
import { product_import } from '../../bin/lib/product.js'

const { item_html } = await product_import('items')
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
 * The model a turn should run on.
 * @param {{ on: boolean, approved: boolean, active: string[], escalated: Set<string> }} state
 * @returns {'cheap' | 'frontier'}
 */
export const route = ({ on, approved, active, escalated }) =>
  on && approved && active.length > 0 && !active.some(id => escalated.has(id)) ? 'cheap' : 'frontier'

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
 * The one approved plan with an active node, or null when none or several.
 * @param {string} plans
 * @param {Iterable<string>} [ignored]
 */
export const working_plan = (plans, ignored = []) => {
  const found = plan_files(plans, ignored)
    .map(({ file }) => join(plans, file))
    .filter(file => {
      const text = readFileSync(file, 'utf8')
      return approved(text) && nodes_in(text, 'active').length > 0
    })
  return found.length === 1 ? found[0] : null
}

/** @param {{ provider: string, id: string } | undefined} model */
const name_of = model => (model ? `${model.provider}/${model.id}` : '')

/**
 * @param {ExtensionAPI} pi
 * @param {{ plans?: string, ignored?: Iterable<string>, log?: string }} [where]
 */
export default (
  pi,
  {
    plans = join(root, plans_path(root)),
    ignored = plans_ignore(root),
    log = join(root, 'vault/Prewalk/escalations.html')
  } = {}
) => {
  let on = true
  let target = DEFAULT_TARGET
  /** @type {any} */
  let frontier = null
  /** @type {string | null} */
  let plan = null
  let state = { approved: false, active: /** @type {string[]} */ ([]) }
  const escalated = new Set()
  /** @type {Map<string, string>} */
  const errors = new Map()
  const failed = new Set()
  /** @type {Map<string, Set<string>>} */
  const models = new Map()
  const verified = new Set()
  let nudge = 'none'

  /**
   * @param {string} node
   * @param {string} reason
   * @param {string} model
   */
  const record = (node, reason, model) => append('escalation', { node, reason, model })

  /**
   * @param {'escalation' | 'outcome'} kind
   * @param {Record<string, string>} fields
   */
  const append = (kind, fields) => {
    const at = new Date().toISOString()
    mkdirSync(dirname(log), { recursive: true })
    appendFileSync(
      log,
      item_html(`prewalk/${kind}`, { plan: relative(root, plan ?? ''), ...fields, at }).replace(
        'itemscope',
        `itemscope itemid="/prewalk/${kind}s/${fields.node}/${at}"`
      )
    )
  }

  /** @param {any} ctx */
  const read_plan = ctx => {
    if (!plan || !existsSync(plan)) return
    const text = readFileSync(plan, 'utf8')
    const active = nodes_in(text, 'active')
    const blocked = nodes_in(text, 'blocked')
    for (const id of state.active.filter(id => !active.includes(id))) {
      if (!blocked.includes(id) && !verified.has(id)) {
        record(id, 'finished without a passing spec', name_of(ctx.model))
        ctx.ui.notify(`Prewalk: ${id} finished without a passing spec`, 'warning')
      }
      append('outcome', {
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

  pi.on('tool_result', (event, ctx) => {
    if (!on) return
    const file = ['read', 'edit', 'write'].includes(event.toolName) && plan_of(event.input?.path, ctx.cwd, plans)
    if (file) {
      if (file !== plan) state = { approved: false, active: [] }
      plan = file
      read_plan(ctx)
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
        record(id, 'spec failed', name_of(ctx.model))
      }
    }
  })

  pi.on('turn_end', async (event, ctx) => {
    if (on && !plan) {
      plan = working_plan(plans, ignored)
      read_plan(ctx)
    }
    const current = name_of(ctx.model)
    for (const id of state.active) models.set(id, (models.get(id) ?? new Set()).add(current))
    if (on && current === target && event.message?.stopReason === 'error') {
      const error = event.message.errorMessage || 'unknown error'
      for (const id of state.active.filter(id => !escalated.has(id))) {
        escalated.add(id)
        errors.set(id, error)
        record(id, `model error: ${error}`, current)
      }
    }
    const want = route({ on, ...state, escalated })
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
    if (want === 'frontier' && frontier && current === target) {
      if (!(await pi.setModel(frontier))) return
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
    frontier = null
    plan = null
    state = { approved: false, active: [] }
    nudge = 'none'
    escalated.clear()
    verified.clear()
    errors.clear()
    failed.clear()
    models.clear()
  })

  pi.registerCommand('prewalk', {
    description: 'Cheap model works approved plan nodes. /prewalk [provider/id | off | on]',
    handler: async (args, ctx) => {
      const arg = args?.trim() ?? ''
      if (arg === 'off' || arg === 'on') on = arg === 'on'
      else if (arg) target = arg
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
