/**
 * Prewalk: the frontier model shapes and gates a plan, a cheap model works its nodes.
 *
 * Arms on the plan `/planning <name>` names, or else the first plan the session
 * edits, when it carries `- Gate 1: approved`. An edit to an approved plan takes
 * over from an edited plan that is unapproved, or idle while the edited one has an
 * active node; a named plan stays. Each
 * binding is announced. A read arms only an unbound session, and only on an
 * approved plan with an active node. A mistyped `/plan…` command still names its plan. The frontier works the plan's first node whole, so the pattern is set before
 * the cheap model takes over: once a node's spec passes, later nodes run cheap.
 * A session on the cheap model stays there, since a switch back rewrites the
 * whole cache. A failing spec, a cheap-model error, or a gate asks for
 * `/prewalk next`: a fresh session on the model the plan needs, told the old
 * session's id for `remember`. A failed node stays on the frontier model across
 * sessions until it finishes. Scott saying he is lost or confused brings the
 * frontier model back at once, mid-node. Each node entering and leaving
 * `active` through this session's own change, and each escalation, is an item in
 * `vault/Projects/realness-planning-performance/escalations.html`.
 *
 * /prewalk              - status
 * /prewalk next         - fresh session on the model the plan needs
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

/** Status key that names the bound plan, which the footer shows. */
export const PLAN_KEY = 'plan'

/** A plan's name from its path in the plans folder: `a/index.md` and `a.md` are both `a`. */
export const plan_name = path => path.replace(/\/index\.md$|\.md$/, '')

export const DEFAULT_TARGET = 'openrouter/deepseek/deepseek-v4.1-flash-1017'

/** Mid-session switches one session may make: out to the cheap model, back once for a lost Scott. */
export const MAX_SWITCHES = 2
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

/** Scott asking for plain words, which brings the frontier model back mid-node. */
const LOST = new RegExp(
  [
    String.raw`\bi'?m lost\b`,
    String.raw`\bi am lost\b`,
    String.raw`\blost me\b`,
    String.raw`\bconfus`,
    String.raw`\bstruggl\w* to (understand|follow)\b`,
    String.raw`\bdon'?t understand\b`,
    String.raw`\bdo not understand\b`,
    String.raw`\bno sense\b`,
    String.raw`\btoo much detail\b`,
    String.raw`\bsimpler\b`
  ].join('|'),
  'i'
)

/** Jev's probability above which a message reads as Scott frustrated, lost, or correcting the agent. */
export const UPSET = 0.7

const UPSET_QUESTION = {
  upset: {
    type: 'bool',
    instructions:
      'This is the latest message from Scott to his coding agent, after his earlier messages. Scott is dyslexic, so typos are normal and mean nothing. Read the mood across the messages. Is Scott frustrated, lost, confused, resigned, or correcting the agent for doing the wrong thing in the latest one?',
    criteria: {
      true: 'Frustrated, lost, confused, or correcting the agent',
      false: 'A plain request, approval, or question with no frustration'
    }
  }
}

/** How many earlier messages Jev reads for mood. */
export const EARLIER = 2

/**
 * Scott's own words: skill text and fenced code removed.
 * @param {unknown} prompt
 */
export const own_words = prompt =>
  String(prompt ?? '')
    .replace(/<skill [\s\S]*?<\/skill>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim()

/**
 * Whether Jev reads the message as Scott upset; false when no Jev model answers.
 * @param {any} registry
 * @param {string} message
 * @param {string[]} earlier
 * @param {(text: string, level: string) => void} [notify]
 */
export const upset = async (registry, message, earlier = [], notify = () => {}) => {
  const jev = (await registry.getAvailableOfType?.('classifier'))?.find((/** @type {any} */ m) => /jev/.test(m.id))
  if (!jev) return false
  const result = await registry.classify(jev, { state: { earlier, message }, questions: UPSET_QUESTION }).catch(
    (/** @type {Error} */ error) =>
      (notify(`Prewalk: Jev failed: ${error.message}`, 'warning'), null)
  )
  return result?.stopReason === 'stop' && result.answers.upset.probability >= UPSET
}

/** @param {unknown} prompt */
export const lost = prompt => LOST.test(String(prompt ?? '').replace(/```[\s\S]*?```/g, ''))

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
  const match = /^(?:<skill name="planning"[\s\S]*?<\/skill>\n\n|\/plan\w*\s+)(\S+)/.exec(prompt ?? '')
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

/** @param {{ approved: boolean, active: string[] }} state */
const ready = state => state.approved && state.active.length > 0

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
  {
    plans = join(root, plans_path(root)),
    log = join(root, 'vault/Projects/realness-planning-performance/escalations.html')
  } = {}
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
  /** Mid-session switches made, each one a full cache rewrite at 1.25x. */
  let switches = 0
  /** @type {string[]} */
  let said = []
  let nudge = 'none'
  /** Reasons this session already asked for `/prewalk next`. */
  const told = new Set()

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
   * @param {'start' | 'escalation' | 'outcome' | 'handoff'} kind
   * @param {Record<string, string>} fields
   */
  const append = (ctx, kind, fields) => {
    const at = new Date().toISOString()
    pi.appendEntry('prewalk', { kind, ...fields, at })
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

  /**
   * The frontier model this session or an earlier one handed off from, read from the bound plan's last handoff.
   * @param {any} ctx
   */
  const frontier_of = ctx => {
    if (frontier || !existsSync(log)) return frontier
    const key = relative(root, plan ?? '')
    const last = read_items(readFileSync(log, 'utf8'), 'prewalk/handoff')
      .filter(item => item.plan === key)
      .at(-1)
    if (!last?.frontier) return null
    const [provider, ...rest] = String(last.frontier).split('/')
    return ctx.modelRegistry.find(provider, rest.join('/')) ?? null
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

  /** Active nodes of the bound plan whose last log entry is a spec failure or model error. */
  const open_escalations = () => {
    if (!existsSync(log)) return []
    const html = readFileSync(log, 'utf8')
    const key = relative(root, plan ?? '')
    const items = [
      ...read_items(html, 'prewalk/escalation').map(item => ({
        ...item,
        open: /^(spec failed|model error)/.test(item.reason)
      })),
      ...read_items(html, 'prewalk/outcome').map(item => ({ ...item, open: false }))
    ]
      .filter(item => item.plan === key)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    const open = new Set()
    for (const item of items) item.open ? open.add(item.node) : open.delete(item.node)
    return [...open]
  }

  /**
   * @param {any} ctx
   * @param {boolean} own - this session made the change, so it logs the nodes it moved
   */
  const read_plan = (ctx, own) => {
    if (!plan || !existsSync(plan)) return
    const text = readFileSync(plan, 'utf8')
    const active = nodes_in(text, 'active')
    const blocked = nodes_in(text, 'blocked')
    if (!own) {
      if (active.length) nudge = 'none'
      state = { approved: approved(text), active }
      return
    }
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
  const bind = (file, ctx, own = false) => {
    const moved = file !== plan
    if (moved) state = { approved: false, active: [] }
    plan = file
    ctx.ui.setStatus(PLAN_KEY, plan_name(relative(plans, file)))
    read_plan(ctx, own)
    if (moved) for (const id of open_escalations().filter(id => state.active.includes(id))) escalated.add(id)
    if (moved)
      ctx.ui.notify(
        `Prewalk: bound to ${relative(plans, file)}${state.approved ? ' (Gate 1 approved)' : ', no Gate 1 approval, frontier only'}`,
        'info'
      )
  }

  pi.on('before_agent_start', async (event, ctx) => {
    const file = plan_named(event.prompt, plans)
    if (file) {
      named = true
      bind(file, ctx)
    }
    const words = own_words(event.prompt)
    const earlier = said
    said = [...said, words].filter(Boolean).slice(-EARLIER)
    const cheap = on && name_of(ctx.model) === target && frontier_of(ctx)
    const why = !cheap
      ? null
      : lost(event.prompt)
        ? 'Scott is lost'
        : words && state.active.length > 0 && (await upset(ctx.modelRegistry, words, earlier, ctx.ui.notify))
          ? 'Scott is upset'
          : null
    const back = why && cheap
    if (back) {
      for (const id of state.active.filter(id => !escalated.has(id))) {
        escalated.add(id)
        record(ctx, id, why, name_of(ctx.model))
      }
      if (switches < MAX_SWITCHES && (await pi.setModel(back))) {
        switches++
        routed = false
        ctx.ui.notify(`Prewalk: back to ${name_of(back)}: ${why}`, 'info')
        return {
          message: {
            customType: 'prewalk',
            display: false,
            content:
              'Prewalk: Scott is frustrated or lost. You are back on the frontier model. Act on his message now: do the work or write the summary yourself, in plain short words. Do not ask him to type a command.'
          }
        }
      }
    }
  })

  pi.on('tool_result', (event, ctx) => {
    if (!on) return
    const file = ['read', 'edit', 'write'].includes(event.toolName) && plan_of(event.input?.path, ctx.cwd, plans)
    if (file) {
      if (file === plan) read_plan(ctx, event.toolName !== 'read')
      else if (!plan && event.toolName === 'read' && ready(plan_state(file))) bind(file, ctx)
      else if (event.toolName !== 'read' && (!plan || (!named && takes_over(state, plan_state(file)))))
        bind(file, ctx, true)
      return
    }
    const working = ['edit', 'write'].includes(event.toolName) && plan && state.approved && !state.active.length
    if (working && nudge === 'none') nudge = 'due'
    if (event.toolName !== 'bash') return
    const command = String(event.input?.command ?? '')
    if (!state.active.length || !is_spec_run(command))
      return read_plan(ctx, Boolean(plan) && command.includes(plan_name(relative(plans, plan ?? ''))))
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
      if (switches >= MAX_SWITCHES) return
      frontier = ctx.model
      if (!(await pi.setModel(model))) return
      switches++
      routed = true
      append(ctx, 'handoff', { node: state.active.join('-'), frontier: name_of(frontier) })
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
    if (want === 'frontier' && routed && current === target) {
      const failed = state.active.filter(id => escalated.has(id))
      const reason = failed.length ? failed.join(', ') : 'gate'
      if (told.has(reason)) return
      told.add(reason)
      ctx.ui.notify(
        `Prewalk: ${failed.length ? `${reason} needs` : 'the gate needs'} ${name_of(frontier)}; type /prewalk next for a fresh session`,
        'warning'
      )
      if (!failed.length) return
      const errored = failed.filter(id => errors.has(id))
      const content =
        (errored.length
          ? `Prewalk: the cheaper model failed on ${errored.join(', ')}: ${errors.get(errored[0])}. `
          : `Prewalk: the spec failed on ${failed.join(', ')}. `) +
        'Stop now. Report what failed and where you stopped, in a few lines; never loosen the test. Scott starts a fresh frontier session with /prewalk next.'
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
    told.clear()
    on = true
    routed = false
    switches = 0
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

  /**
   * A fresh session on the model the plan needs, which reads the plan and asks
   * `remember` for this session's decisions instead of carrying its context.
   * @param {any} ctx
   */
  const next = async ctx => {
    if (!plan) return ctx.ui.notify('Prewalk: no plan bound; type /planning <name> first', 'warning')
    const want = route({ on, ...state, escalated, proven: proven_plan() })
    const [provider, ...rest] = target.split('/')
    const model = want === 'cheap' ? ctx.modelRegistry.find(provider, rest.join('/')) : (frontier_of(ctx) ?? ctx.model)
    if (model && name_of(model) !== name_of(ctx.model)) await pi.setModel(model)
    const failed = state.active.filter(id => escalated.has(id))
    const kickoff = [
      `/planning ${plan_name(relative(plans, plan))}`,
      state.active.length
        ? `Continue node ${state.active.join(', ')}.${failed.length ? ` Its spec failed on the cheaper model; find the cause.` : ''}`
        : 'No node is active: this is a gate. Show Scott the plan state and ask how to go on.',
      `The previous session is ${session_of(ctx)}. Read the plan, then the previous node's changes, then use remember with that session for decisions you need.`
    ].join('\n')
    await ctx.newSession({
      parentSession: ctx.sessionManager.getSessionFile?.(),
      withSession: async (/** @type {any} */ fresh) => fresh.sendUserMessage(kickoff)
    })
  }

  pi.registerCommand('prewalk', {
    description: 'Cheap model works approved plan nodes. /prewalk [next | provider/id | off | on]',
    handler: async (args, ctx) => {
      const arg = args?.trim() ?? ''
      if (arg === 'next') return next(ctx)
      if (arg === 'off' || arg === 'on') on = arg === 'on'
      else if (arg) {
        target = arg
        routed = false
      }
      const where = plan ? `${relative(root, plan)}, ${state.approved ? 'approved' : 'not approved'}` : 'no plan bound'
      ctx.ui.notify(
        `Prewalk ${on ? 'on' : 'off'}: ${target}; ${where}; active ${state.active.join(', ') || 'none'}`,
        'info'
      )
    }
  })
}
