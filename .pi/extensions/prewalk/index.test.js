import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import prewalk, { MAX_SWITCHES, is_spec_run, lost, plan_name, plan_named, plan_of, route, takes_over } from './index.js'

const scratch = new URL('../../../artifacts/', import.meta.url).pathname
mkdirSync(scratch, { recursive: true })
const dir = mkdtempSync(join(scratch, 'prewalk-'))
after(() => rmSync(dir, { recursive: true, force: true }))

const FRONTIER = { provider: 'anthropic', id: 'opus' }
const CHEAP = { provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash-1017' }

/** @param {{ gate?: string, active?: string, done?: string }} shape */
const plan_text = ({ gate = '', active = '', done = '' }) =>
  [
    '# P',
    '```mermaid',
    'flowchart TD',
    '  a1["a1 one"] --> b2["b2 two"]',
    '  b2["b2 two"] --> c3["c3 three"]',
    active && `  class ${active} active;`,
    done && `  class ${done} done;`,
    '```',
    '## Notes',
    '### Decisions',
    gate
  ].join('\n')

/** A pi and a ctx that record what the extension does. */
const harness = name => {
  const plans = join(dir, name, 'plans')
  mkdirSync(plans, { recursive: true })
  const log = join(dir, name, 'escalations.html')
  const handlers = {}
  const commands = {}
  const notes = []
  const statuses = {}
  const ctx = {
    cwd: dir,
    model: FRONTIER,
    sessionManager: { getSessionId: () => `session-${name}` },
    modelRegistry: { find: (provider, id) => [FRONTIER, CHEAP].find(m => m.provider === provider && m.id === id) },
    ui: {
      notify: (text, level) => notes.push({ text, level }),
      setStatus: (key, text) => (statuses[key] = text)
    }
  }
  const pi = {
    on: (event, handler) => (handlers[event] = handler),
    registerCommand: (command, { handler }) => (commands[command] = handler),
    setModel: async model => ((ctx.model = model), true)
  }
  prewalk(/** @type {any} */ (pi), { plans, log })
  const file = join(plans, 'p.md')
  const api = {
    ctx,
    notes,
    statuses,
    log,
    write: shape => {
      writeFileSync(file, plan_text(shape))
      handlers.tool_result({ toolName: 'edit', input: { path: file } }, ctx)
    },
    shell: shape => {
      writeFileSync(file, plan_text(shape))
      handlers.tool_result({ toolName: 'bash', input: { command: `sed -i '' s/x/y/ ${file}` }, isError: false }, ctx)
    },
    change: () => handlers.tool_result({ toolName: 'edit', input: { path: join(dir, 'src.js') } }, ctx),
    seed: shape => writeFileSync(file, plan_text(shape)),
    spec: ok =>
      handlers.tool_result({ toolName: 'bash', input: { command: 'node --test a.spec.js' }, isError: !ok }, ctx),
    turn: (message = { stopReason: 'stop' }) => handlers.turn_end({ entries: [], message }, ctx),
    command: args => commands.prewalk(args, ctx),
    read: () => handlers.tool_result({ toolName: 'read', input: { path: file } }, ctx),
    says: text => handlers.before_agent_start({ prompt: text }, ctx),
    planning: name =>
      handlers.before_agent_start({ prompt: `<skill name="planning" location="x">\nbody\n</skill>\n\n${name}` }, ctx),
    other: shape => {
      const other = join(plans, 'other.md')
      writeFileSync(other, plan_text(shape))
      handlers.tool_result({ toolName: 'edit', input: { path: other } }, ctx)
    }
  }
  /** Frontier works a1 until its spec passes, which sets the pattern. */
  api.prove = async () => {
    api.write({ gate: '- Gate 1: approved', active: 'a1' })
    await api.turn()
    api.spec(true)
    api.write({ gate: '- Gate 1: approved', done: 'a1' })
  }
  return api
}

test('spec runs, routes, and plan paths', () => {
  assert.equal(is_spec_run('node --test .pi/bin/specs/x.spec.js'), true)
  assert.equal(is_spec_run('npm --prefix apps/realness run test:browser'), true)
  assert.equal(is_spec_run('npm run check'), false)
  assert.equal(is_spec_run('cd apps/realness; npx vitest run specs/x.spec.js'), true)
  assert.equal(is_spec_run('node --test-concurrency=1 --test specs/a.spec.js'), true)
  assert.equal(is_spec_run('ls vitest*; cat vitest.config.js | head; grep -n \'"test"\' package.json'), false)
  assert.equal(is_spec_run('cat specs/scouts/halo.spec.js'), false)
  const escalated = new Set(['b2'])
  assert.equal(route({ on: true, approved: true, active: ['a1'], escalated, proven: true }), 'cheap')
  assert.equal(route({ on: true, approved: true, active: ['b2'], escalated, proven: true }), 'frontier')
  assert.equal(route({ on: true, approved: true, active: [], escalated, proven: true }), 'frontier')
  assert.equal(route({ on: true, approved: false, active: ['a1'], escalated, proven: true }), 'frontier')
  assert.equal(route({ on: false, approved: true, active: ['a1'], escalated, proven: true }), 'frontier')
  assert.equal(route({ on: true, approved: true, active: ['a1'], escalated }), 'frontier')
  assert.equal(plan_of('vault/Projects/p.md', '/r', '/r/vault/Projects'), '/r/vault/Projects/p.md')
  assert.equal(plan_of('/r/README.md', '/r', '/r/vault/Projects'), null)
})

test('an unapproved plan stays on the frontier model', async () => {
  const h = harness('unapproved')
  h.write({ active: 'a1' })
  assert.equal(await h.turn(), undefined)
  assert.equal(h.ctx.model, FRONTIER)
})

test('the frontier works the first node; later nodes run cheap', async () => {
  const h = harness('approved')
  h.write({ gate: '- Gate 1: approved' })
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  const result = await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  assert.match(result.entries[0].content, /node b2 .* run the node's own spec/)
})

test('a failing spec returns the node to the frontier model and logs it', async () => {
  const h = harness('failing')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  h.spec(false)
  const result = await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
  assert.match(result.entries[0].content, /spec failed on b2/)
  const html = readFileSync(h.log, 'utf8')
  assert.match(html, /itemtype="\/prewalk\/escalation"/)
  assert.match(html, /<span itemprop="node">b2<\/span>.*spec failed/)
})

test('a session stops switching after two, since each one rewrites the cache', async () => {
  assert.equal(MAX_SWITCHES, 2)
  const h = harness('cap')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  h.spec(false)
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'c3' })
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
})

test('Scott saying he is lost brings the frontier model back at once', async () => {
  const h = harness('lost')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  await h.says('I am struggling to understand you')
  assert.equal(h.ctx.model, FRONTIER)
  assert.match(readFileSync(h.log, 'utf8'), /<span itemprop="node">b2<\/span>.*Scott is lost/)
  await h.says('run the spec')
  assert.equal(h.ctx.model, FRONTIER)
})

test('only a lost Scott brings the frontier model back', () => {
  for (const text of ['I am lost', 'i’m confused', 'struggling to understand you', 'makes no sense', 'too much detail'])
    assert.equal(lost(text), true, text)
  for (const text of ['Lost uncommitted work: replay its session edits', 'run the spec', 'plan node s1'])
    assert.equal(lost(text), false, text)
})

test('a cheap-model error turn returns the session to the frontier model with a notice', async () => {
  const h = harness('error')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  const result = await h.turn({ stopReason: 'error', errorMessage: 'provider 503' })
  assert.equal(h.ctx.model, FRONTIER)
  assert.match(result.entries[0].content, /cheaper model failed on b2: provider 503/)
  assert.ok(h.notes.some(note => /back to anthropic\/opus for b2/.test(note.text)))
  assert.match(readFileSync(h.log, 'utf8'), /<span itemprop="node">b2<\/span>.*model error: provider 503/)
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
})

test('each node leaving active logs one outcome beside the escalations', async () => {
  const h = harness('outcome')
  await h.prove()
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  await h.turn()
  h.write({ gate: '- Gate 1: approved', done: 'a1,b2' })
  const html = readFileSync(h.log, 'utf8')
  const outcomes = html.split('<article').filter(item => item.includes('itemtype="/prewalk/outcome"'))
  assert.equal(outcomes.length, 2)
  assert.match(
    outcomes[0],
    /itemprop="node">a1<.*itemprop="status">done<.*itemprop="models">anthropic\/opus<.*itemprop="spec">passed<.*itemprop="escalated">no</s
  )
  assert.match(
    outcomes[1],
    /itemprop="node">b2<.*itemprop="models">anthropic\/opus, openrouter\/deepseek\/deepseek-v4.1-flash-1017<.*itemprop="spec">none<.*itemprop="escalated">no</s
  )
  assert.match(html, /itemtype="\/prewalk\/escalation"/)
})

test('an error turn on the frontier model changes nothing', async () => {
  const h = harness('frontier-error')
  h.write({ gate: '- Gate 1: approved' })
  assert.equal(await h.turn({ stopReason: 'error', errorMessage: 'x' }), undefined)
  assert.equal(h.ctx.model, FRONTIER)
})

test('a node finished without a passing spec is flagged; a verified one is not', async () => {
  const h = harness('finished')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  h.write({ gate: '- Gate 1: approved', done: 'a1,b2' })
  assert.deepEqual(
    h.notes.filter(note => note.level === 'warning').map(note => note.text),
    ['Prewalk: b2 finished without a passing spec']
  )
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
})

test('a plan changed through bash is read again', async () => {
  const h = harness('shell')
  h.write({ gate: '- Gate 1: approved' })
  await h.prove()
  h.shell({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  h.shell({ gate: '- Gate 1: approved', done: 'a1,b2' })
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
})

test('work on an approved plan with no active node is told to mark one, once', async () => {
  const h = harness('nudge')
  h.write({ gate: '- Gate 1: approved' })
  h.change()
  const result = await h.turn()
  assert.match(result.entries[0].content, /no active node\. If this is node work, mark the node `active`/)
  h.change()
  assert.equal(await h.turn(), undefined)
  await h.prove()
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
})

test('/prewalk off keeps the frontier model', async () => {
  const h = harness('off')
  await h.prove()
  await h.command('off')
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, FRONTIER)
  await h.command('on')
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
})

test('a plan whose node passed its spec keeps its nodes cheap in a new session', async () => {
  const h = harness('found')
  await h.prove()
  const fresh = harness('found')
  fresh.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await fresh.turn()
  assert.equal(fresh.ctx.model, CHEAP)
  const other = harness('none')
  await other.turn()
  assert.equal(other.ctx.model, FRONTIER)
})

test('a session that has not read the plan stays on the frontier model', async () => {
  const h = harness('untouched')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
  const fresh = harness('untouched')
  fresh.seed({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await fresh.turn()
  assert.equal(fresh.ctx.model, FRONTIER)
  assert.equal(fresh.notes.filter(note => /on openrouter\//.test(note.text)).length, 0)
})

test('a manual switch to the cheap model that errors is left alone', async () => {
  const h = harness('manual')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.ctx.model = CHEAP
  const result = await h.turn({ stopReason: 'error', errorMessage: 'This operation was aborted' })
  assert.equal(result, undefined)
  assert.equal(h.ctx.model, CHEAP)
  assert.doesNotMatch(readFileSync(h.log, 'utf8'), /model error/)
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
})

test('each log item names the session that wrote it', async () => {
  const h = harness('session-id')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  assert.match(readFileSync(h.log, 'utf8'), /itemprop="session">session-session-id</)
})

test('a node entering active logs one start item with the model', async () => {
  const h = harness('start')
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  await h.turn()
  const html = readFileSync(h.log, 'utf8')
  const starts = html.split('<article').filter(item => item.includes('itemtype="/prewalk/start"'))
  assert.equal(starts.length, 1)
  assert.match(starts[0], /itemprop="plan">.*plans\/p\.md<.*itemprop="node">a1<.*itemprop="model">anthropic\/opus</s)
})

test('/planning <name> finds the plan by folder, file, or part of its name', () => {
  const plans = join(dir, 'named')
  mkdirSync(join(plans, 'realness-scouts'), { recursive: true })
  writeFileSync(join(plans, 'realness-scouts', 'index.md'), '')
  writeFileSync(join(plans, 'realness-presentation.md'), '')
  const ask = name => plan_named(`<skill name="planning" location="x">\nbody\n</skill>\n\n${name}`, plans)
  assert.equal(ask('realness-scouts'), join(plans, 'realness-scouts', 'index.md'))
  assert.equal(ask('realness-presentation more words'), join(plans, 'realness-presentation.md'))
  assert.equal(ask('presentation'), join(plans, 'realness-presentation.md'))
  assert.equal(ask('realness'), null)
  assert.equal(plan_named('read the scouts plan', plans), null)
})

test('reading a plan never routes the session to it', async () => {
  const h = harness('read-only')
  await h.prove()
  await h.command('on')
  const fresh = harness('read-only')
  fresh.seed({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  fresh.read()
  await fresh.turn()
  assert.equal(fresh.ctx.model, FRONTIER)
})

test('/planning binds the plan; other plans with active nodes are ignored', async () => {
  const h = harness('bound')
  await h.prove()
  const fresh = harness('bound')
  fresh.seed({ gate: '- Gate 1: approved', done: 'a1' })
  fresh.planning('p')
  fresh.other({ gate: '- Gate 1: approved', active: 'a1' })
  await fresh.turn()
  assert.equal(fresh.ctx.model, FRONTIER)
  fresh.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await fresh.turn()
  assert.equal(fresh.ctx.model, CHEAP)
})

test('an edited approved plan takes over from an unapproved or idle one', () => {
  const idle = { approved: true, active: [] }
  const working = { approved: true, active: ['s1'] }
  assert.equal(takes_over({ approved: false, active: [] }, idle), true)
  assert.equal(takes_over(idle, working), true)
  assert.equal(takes_over(working, { approved: true, active: ['b2'] }), false)
  assert.equal(takes_over(idle, idle), false)
  assert.equal(takes_over({ approved: false, active: [] }, { approved: false, active: ['a1'] }), false)
})

test('the session moves to the approved plan it works, and says so', async () => {
  const h = harness('takeover')
  h.other({})
  assert.match(h.notes.at(-1).text, /bound to other\.md, no Gate 1 approval/)
  h.write({ gate: '- Gate 1: approved', active: 'a1' })
  assert.match(h.notes.at(-1).text, /bound to p\.md \(Gate 1 approved\)/)
  await h.turn()
  h.spec(true)
  h.write({ gate: '- Gate 1: approved', done: 'a1', active: 'b2' })
  await h.turn()
  assert.equal(h.ctx.model, CHEAP)
})

test('the bound plan is named in a status the footer shows', () => {
  const h = harness('status')
  h.write({ gate: '- Gate 1: approved' })
  assert.equal(h.statuses.plan, 'p')
  assert.equal(plan_name('realness-scouts/index.md'), 'realness-scouts')
})
