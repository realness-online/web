import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import footer_filter, {
  billing_label,
  context_label,
  fit,
  DEFAULT_HIDDEN,
  filter_provider,
  footer_parts,
  hidden_keys,
  model_label,
  place_label,
  paint_place,
  branch_level,
  usage_label,
  week_label
} from './index.js'

const scratch = join(process.cwd(), 'artifacts/footer-filter')

const provider = () => {
  const statuses = new Map()
  return {
    statuses,
    getExtensionStatuses: () => statuses,
    setExtensionStatus(key, text) {
      if (text === undefined) statuses.delete(key)
      else statuses.set(key, text)
    }
  }
}

describe('hidden_keys', () => {
  it('reads footer.hideStatuses from settings', () => {
    mkdirSync(scratch, { recursive: true })
    const path = join(scratch, 'settings.json')
    writeFileSync(path, JSON.stringify({ footer: { hideStatuses: ['rewind'] } }))
    assert.deepEqual([...hidden_keys(path)], ['rewind'])
  })

  it('falls back to the default list', () => {
    assert.deepEqual([...hidden_keys(join(scratch, 'missing.json'))], DEFAULT_HIDDEN)
  })
})

describe('filter_provider', () => {
  it('drops hidden keys already set and set later, keeps the rest', () => {
    const data = provider()
    data.setExtensionStatus('claude-oauth-ready', '✓ Claude OAuth ready')
    filter_provider(data, new Set(['claude-oauth-ready']))
    data.setExtensionStatus('claude-oauth-ready', '✓ Claude OAuth active')
    data.setExtensionStatus('claude-oauth-issue', 'limit')
    assert.deepEqual([...data.statuses], [['claude-oauth-issue', 'limit']])
  })
})

describe('labels', () => {
  it('shortens the Claude usage warning', () => {
    assert.deepEqual(usage_label("You've used 77% of your weekly limit · resets 10am"), {
      text: 'wk 77%',
      level: 'dim'
    })
    assert.deepEqual(usage_label("You've used 91% of your session limit"), { text: '5h 91%', level: 'warning' })
    assert.deepEqual(usage_label("You've hit your weekly limit"), { text: 'limit hit', level: 'error' })
    assert.equal(usage_label(undefined), null)
  })

  it('reads weekly usage from Anthropic headers', () => {
    assert.deepEqual(week_label({ 'anthropic-ratelimit-unified-7d-utilization': '0.42' }), {
      text: 'wk 42%',
      level: 'dim'
    })
    assert.deepEqual(week_label({ 'anthropic-ratelimit-unified-7d-utilization': '0.95' }), {
      text: 'wk 95%',
      level: 'warning'
    })
    assert.equal(week_label({}), null)
    assert.equal(week_label(undefined), null)
  })

  it('shows weekly usage only on Anthropic models, and the warning first', () => {
    const week = { text: 'wk 42%', level: 'dim' }
    const parts = (model, statuses = new Map()) =>
      footer_parts({ entries: [], model, statuses, branch: null, porcelain: null, week }).parts.map(part => part.text)
    assert.ok(parts({ provider: 'anthropic', id: 'claude' }).includes('wk 42%'))
    assert.ok(!parts({ provider: 'openai', id: 'gpt' }).includes('wk 42%'))
    const warned = new Map([['claude-oauth-issue', "You've used 91% of your session limit"]])
    assert.ok(parts({ provider: 'anthropic', id: 'claude' }, warned).includes('5h 91%'))
  })

  it('shows context fill against the window', () => {
    assert.deepEqual(context_label({ percent: 7.94, contextWindow: 1_000_000 }), { text: '7.9%/1.0M', level: 'dim' })
    assert.equal(context_label({ percent: 95, contextWindow: 200_000 }).text, '95.0%/200k')
    assert.equal(context_label({ percent: 95, contextWindow: 200_000 }).level, 'error')
  })

  it('puts the thinking level of the latest answer left of its model', () => {
    const entries = [
      { type: 'message', message: { role: 'assistant', model: 'house', responseModel: 'opus', thinkingLevel: 'high' } },
      { type: 'message', message: { role: 'user' } }
    ]
    assert.equal(model_label(entries, { id: 'house', reasoning: true }, 'low'), 'high · opus')
    assert.equal(model_label([], { id: 'opus', reasoning: true }, 'low'), 'low · opus')
    assert.equal(model_label([], { id: 'plain' }, 'off'), 'plain')
  })

  it('shows a model or thinking change made after the latest answer', () => {
    const answer = { type: 'message', message: { role: 'assistant', model: 'opus', thinkingLevel: 'high' } }
    const opus = { id: 'opus', reasoning: true }
    assert.equal(model_label([answer, { type: 'thinking_level_change' }], opus, 'low'), 'low · opus')
    assert.equal(
      model_label([answer, { type: 'model_change' }], { id: 'sonnet', reasoning: true }, 'high'),
      'high · sonnet'
    )
  })

  it('names subscription or credits', () => {
    const registry = { isUsingOAuth: model => model.id === 'opus' }
    assert.equal(billing_label(registry, { id: 'opus' }), 'sub')
    assert.equal(billing_label(registry, { id: 'kimi' }), 'credits')
  })

  it('cuts the start of the place when the line is narrow, keeping its end', () => {
    const right = [{ text: 'low · opus' }, { text: 'wk 77%' }]
    const line = fit('realness-chat-plan-label (main)', right, 34)
    assert.equal(line.left, '…-label (main)')
    assert.equal(line.left.length + line.gap.length + 'low · opus  wk 77%'.length, 34)
    assert.equal(fit('realness-scouts', right, 80).left, 'realness-scouts')
  })

  it('paints the plan dim and the branch by git status', () => {
    const paint = (level, text) => `<${level}>${text}`
    const shown = { plan: 'realness-scouts', branch: 'main', branch_level: 'warning' }
    assert.equal(paint_place('realness-scouts (main)', shown, paint), '<dim>realness-scouts <warning>(main)')
    assert.equal(paint_place('…scouts (main)', shown, paint), '<dim>…scouts <warning>(main)')
    assert.equal(paint_place('(m…', shown, paint), '<warning>(m…')
    assert.equal(paint_place('', shown, paint), '')
    assert.equal(paint_place('realness-scouts', { ...shown, branch: null }, paint), '<dim>realness-scouts')
  })

  it('shows the plan and branch, never the folder', () => {
    assert.equal(place_label(undefined, 'main'), '(main)')
    assert.equal(place_label('realness-one-network', 'main'), 'realness-one-network (main)')
    assert.equal(place_label(undefined, null), '')
  })

  it('colors the branch by git status', () => {
    assert.equal(branch_level(''), 'success')
    assert.equal(branch_level(' M a.js\n'), 'warning')
    assert.equal(branch_level(null), 'dim')
  })

  it('gives the footer as plain values', () => {
    const shown = footer_parts({
      entries: [],
      model: { id: 'opus' },
      thinking: 'low',
      registry: { isUsingOAuth: () => true },
      context: { percent: 7.9, contextWindow: 1_000_000 },
      statuses: new Map([
        ['plan', 'realness-one-network'],
        ['claude-oauth-issue', "You've used 77% of your weekly limit"]
      ]),
      branch: 'main',
      porcelain: ' M a.js\n'
    })
    assert.deepEqual(shown, {
      plan: 'realness-one-network',
      branch: 'main',
      branch_level: 'warning',
      parts: [
        { text: 'opus', level: 'dim' },
        { text: 'sub', level: 'dim' },
        { text: '7.9%/1.0M', level: 'dim' },
        { text: 'wk 77%', level: 'dim' }
      ]
    })
    const bare = footer_parts({ entries: [], statuses: new Map(), branch: null, porcelain: null })
    assert.equal(bare.plan, '')
    assert.equal(bare.branch, null)
  })
})

describe('extension', () => {
  it('renders one line with usage and moves other statuses below', async () => {
    const data = { ...provider(), getGitBranch: () => 'main', onBranchChange: () => () => {} }
    let start
    let footer
    const told = []
    footer_filter({
      events: { emit: (name, parts) => told.push([name, parts.plan]) },
      on: (name, handler) => name === 'session_start' && (start = handler),
      getThinkingLevel: () => 'low'
    })
    await start(
      {},
      {
        hasUI: true,
        model: { id: 'opus', reasoning: true },
        modelRegistry: { isUsingOAuth: () => true },
        getContextUsage: () => ({ percent: 7.9, contextWindow: 1_000_000 }),
        sessionManager: { getCwd: () => '/srv/app', getBranch: () => [] },
        ui: {
          setFooter: factory =>
            (footer = factory(
              { requestRender() {} },
              {
                colors: {},
                fg(_level, text) {
                  return this.colors && text
                }
              },
              data
            ))
        }
      }
    )
    data.setExtensionStatus('claude-oauth-ready', '✓')
    data.setExtensionStatus('claude-oauth-issue', "You've used 77% of your weekly limit · resets 10am")
    data.setExtensionStatus('rewind', 'saved')
    data.setExtensionStatus('plan', 'realness-one-network')
    const [line, second] = footer.render(80)
    assert.match(line, /^realness-one-network \(main\) +low · opus  sub  7\.9%\/1\.0M  wk 77%$/)
    assert.equal(second, 'saved')
    assert.match(footer.render(50)[0], /^…etwork \(main\)  low · opus  sub  7\.9%\/1\.0M  wk 77%$/)
    footer.render(80)
    assert.deepEqual(told, [['footer:parts', 'realness-one-network']])
  })
})
