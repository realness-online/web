import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  charge,
  events_from,
  intervals_of,
  render,
  render_models,
  render_nodes,
  summarize,
  summarize_models,
  summarize_nodes,
  tier_of,
  turns_from
} from '../../prewalk/spend.js'

const usage = ({ input = '2', output = '100', read = '4000', write = '1000' } = {}) =>
  `<div itemprop="usage" itemscope><data itemprop="input" value="${input}"></data><data itemprop="output" value="${output}"></data><data itemprop="cacheRead" value="${read}"></data><data itemprop="cacheWrite" value="${write}"></data><data itemprop="totalTokens" value="5102"></data><div itemprop="cost" itemscope><data itemprop="input" value="0.00001"></data><data itemprop="output" value="0.002"></data><data itemprop="cacheRead" value="0.0005"></data></div></div>`

const turn = ({ model, provider = 'anthropic', at = '2026-11-08T10:00:00.000Z' }) =>
  `<article itemscope itemtype="/sessions/message"><span itemprop="timestamp">${at}</span><span itemprop="provider">${provider}</span><span itemprop="model">${model}</span>${usage()}</article>`

const page = (...articles) => articles.join('')

test('a turn keeps its model, tokens, and cost', () => {
  const [one] = turns_from(page(turn({ model: 'claude-opus-5-5' })))
  assert.equal(one.model, 'claude-opus-5-5')
  assert.equal(one.cache_read, 4000)
  assert.equal(one.cache_write, 1000)
  assert.equal(one.cost, 0.00251)
  assert.equal(one.at, '2026-11-08T10:00:00.000Z')
})

test('a turn that is not a message is not counted', () => {
  const html = page(
    '<article itemscope itemtype="/sessions/model_change"><span itemprop="modelId">claude-opus-5-5</span></article>',
    turn({ model: 'claude-opus-5-5' })
  )
  assert.equal(turns_from(html).length, 1)
})

test('the cheap tier is recognised by its model id', () => {
  assert.equal(tier_of('openrouter/deepseek/deepseek-v4.1-flash-1017'), 'cheap')
  assert.equal(tier_of('deepseek-v4-flash'), 'cheap')
  assert.equal(tier_of('claude-opus-5-5'), 'frontier')
})

test('sessions are summarized with the frontier share of cost', () => {
  const rows = [
    ...turns_from(page(turn({ model: 'claude-opus-5-5' }))).map(row => ({ ...row, session: 'a' })),
    ...turns_from(page(turn({ model: 'openrouter/deepseek/deepseek-v4.1-flash-1017', provider: 'openrouter' }))).map(
      row => ({ ...row, session: 'b' })
    )
  ]
  const summary = summarize(rows)
  assert.equal(summary.groups.length, 2)
  assert.equal(summary.total.cost, 0.00502)
  assert.equal(summary.frontier_share, 0.5)
  assert.equal(summary.cache_ratio, 4)
  const table = render(summary)
  assert.match(table, /\| a \| 1 \| 100% \|/)
  assert.match(table, /Frontier share of cost: 50%\./)
})

const item = (type, fields) =>
  `<article itemscope itemtype="/prewalk/${type}"><dl>${Object.entries(fields)
    .map(([name, value]) => `<dt>${name}</dt><dd><span itemprop="${name}">${value}</span></dd>`)
    .join('')}</dl></article>`

const start = (node, at, model = 'anthropic/opus') => item('start', { plan: 'plans/p.md', node, model, at })
const outcome = (node, at, spec = 'passed') =>
  item('outcome', { plan: 'plans/p.md', node, status: 'done', models: 'anthropic/opus', spec, escalated: 'no', at })

test('prewalk starts and outcomes pair into node intervals', () => {
  const html = [
    start('a1', '2026-11-08T09:59:00.000Z'),
    start('b2', '2026-11-08T10:08:00.000Z'),
    outcome('a1', '2026-11-08T10:07:00.000Z'),
    outcome('b2', '2026-11-08T10:20:00.000Z')
  ].join('')
  const events = events_from(html)
  assert.equal(events.length, 4)
  assert.deepEqual(
    events.map(event => event.kind),
    ['start', 'outcome', 'start', 'outcome']
  )
  const intervals = intervals_of(events)
  assert.equal(intervals.length, 2)
  assert.deepEqual(intervals[0], {
    plan: 'plans/p.md',
    node: 'a1',
    model: 'anthropic/opus',
    start: '2026-11-08T09:59:00.000Z',
    end: '2026-11-08T10:07:00.000Z',
    status: 'done',
    spec: 'passed',
    escalated: 'no'
  })
})

test('a turn is charged to the node active when it ran', () => {
  const rows = [
    ...turns_from(page(turn({ model: 'claude-opus-5-5', at: '2026-11-08T09:58:00.000Z' }))).map(row => ({
      ...row,
      session: 's'
    })),
    ...turns_from(page(turn({ model: 'claude-opus-5-5', at: '2026-11-08T10:00:00.000Z' }))).map(row => ({
      ...row,
      session: 's'
    })),
    ...turns_from(page(turn({ model: 'deepseek-v4-flash', at: '2026-11-08T10:05:00.000Z' }))).map(row => ({
      ...row,
      session: 's'
    })),
    ...turns_from(page(turn({ model: 'deepseek-v4-flash', at: '2026-11-08T10:09:00.000Z' }))).map(row => ({
      ...row,
      session: 's'
    }))
  ]
  const intervals = intervals_of(
    events_from([start('a1', '2026-11-08T09:59:00.000Z'), outcome('a1', '2026-11-08T10:07:00.000Z')].join(''))
  )
  const charged = charge(rows, intervals)
  assert.deepEqual(
    charged.map(row => row.node),
    ['', 'a1', 'a1', '']
  )
  const summary = summarize_nodes(charged)
  assert.equal(summary.groups.length, 2)
  const a1 = summary.groups.find(group => group.node === 'a1')
  assert.equal(a1.turns, 2)
  assert.equal(a1.spec, 'passed')
  assert.equal(a1.frontier_share, 0.5)
  assert.match(render_nodes(summary), /Passing nodes: 1\. Cost per passing node: \$0\.01/)
})

test('models are summarized with tier and cost', () => {
  const rows = [
    ...turns_from(page(turn({ model: 'claude-opus-5-5' }))).map(row => ({ ...row, session: 'a' })),
    ...turns_from(page(turn({ model: 'claude-opus-5-5' }))).map(row => ({ ...row, session: 'a' })),
    ...turns_from(page(turn({ model: 'deepseek-v4-flash' }))).map(row => ({ ...row, session: 'b' }))
  ]
  const summary = summarize_models(rows)
  assert.equal(summary.groups.length, 2)
  assert.equal(summary.groups[0].model, 'claude-opus-5-5')
  assert.equal(summary.groups[0].turns, 2)
  const table = render_models(summary)
  assert.match(table, /\| claude-opus-5-5 \| frontier \| 2 \|/)
  assert.match(table, /\| deepseek-v4-flash \| cheap \| 1 \|/)
})
