import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { out_path } from '#root/lib/output.js'
import {
  all_confirmed,
  box_model_for,
  compare_finds,
  save_box_leads,
  compare_lines,
  confirms,
  run_line,
  side_root
} from '#root/src/scouts/compare.js'

it('runs the house model on a box through the proxy', () => {
  assert.equal(
    box_model_for('openrouter/deepseek/deepseek-v4-flash'),
    'realness/standard'
  )
  assert.equal(box_model_for('realness/house'), 'realness/house')
})

const FIND = (url, score, org) => ({ url, score: String(score), org })

it('a comparison root links the code and keeps its own vault', t => {
  const harness = mkdtempSync(out_path('compare-harness-'))
  t.after(() => rmSync(harness, { recursive: true, force: true }))
  mkdirSync(join(harness, 'apps/realness'), { recursive: true })
  writeFileSync(join(harness, 'package.json'), '{}')
  const plan = join(harness, 'vault/Projects/plan')
  for (const folder of ['', 'Finds', 'Runs', 'Leads'])
    mkdirSync(join(plan, folder), { recursive: true })
  writeFileSync(join(plan, 'scout.html'), '<article></article>')
  writeFileSync(join(plan, 'Sources.md'), '# sources\n')
  writeFileSync(join(plan, 'Runs/runs.html'), '<article></article>')

  const root = join(harness, 'artifacts/side')
  mkdirSync(root, { recursive: true })
  const copied = side_root({ harness, root, plan: 'plan' })

  assert.deepEqual(readdirSync(root).sort(), ['apps', 'package.json', 'vault'])
  assert.deepEqual(readdirSync(copied).sort(), ['Sources.md', 'scout.html'])
  assert.ok(existsSync(join(root, 'apps')), 'the code is shared')
  assert.ok(!existsSync(join(root, 'vault/Projects/plan/Finds')))
})

it('two runs compare by url, with both scores kept', () => {
  const diff = compare_finds(
    [
      FIND('https://a.test/1', 6, 'Toolkit'),
      FIND('https://a.test/2', 6, 'Only box')
    ],
    [
      FIND('https://a.test/1', 8, 'Toolkit'),
      FIND('https://a.test/3', 7, 'Only mac')
    ]
  )
  assert.deepEqual(diff.both, [
    { url: 'https://a.test/1', org: 'Toolkit', box_score: 6, mac_score: 8 }
  ])
  assert.deepEqual(
    diff.box_only.map(find => find.org),
    ['Only box']
  )
  assert.deepEqual(
    diff.mac_only.map(find => find.org),
    ['Only mac']
  )
})

it('one company found at two urls is one lead, not two', () => {
  const diff = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit LLC')],
    [FIND('https://b.test/job/9', 8, 'Toolkit LLC')]
  )
  assert.equal(diff.box_only.length, 0)
  assert.equal(diff.mac_only.length, 0)
  assert.deepEqual(diff.both, [
    {
      url: 'https://a.test/1',
      org: 'Toolkit LLC',
      box_score: 6,
      mac_score: 8,
      mac_url: 'https://b.test/job/9'
    }
  ])
})

it('a find with no company compares by its url', () => {
  const diff = compare_finds(
    [FIND('https://a.test/1', 6, '')],
    [FIND('https://a.test/1', 7, ''), FIND('https://a.test/2', 7, '')]
  )
  assert.equal(diff.both.length, 1)
  assert.deepEqual(
    diff.mac_only.map(find => find.url),
    ['https://a.test/2']
  )
})

it('three runs in a row each say confirmed, and one miss ends it', () => {
  const side = leads => ({
    model: 'm',
    leads,
    problems: 0,
    seconds: 1,
    reads: 1
  })
  const shared = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit')],
    [FIND('https://a.test/1', 8, 'Toolkit')]
  )
  const apart = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit')],
    [FIND('https://a.test/3', 7, 'PathAI')]
  )
  const hit = { box: side(1), mac: side(1), diff: shared }
  const miss = { box: side(1), mac: side(1), diff: apart }
  assert.equal(run_line(2, 3, hit), 'run 2 of 3  confirmed')
  assert.equal(run_line(2, 3, miss), 'run 2 of 3  not confirmed')
  assert.equal(all_confirmed([hit, hit, hit]), true)
  assert.equal(all_confirmed([hit, miss, hit]), false)
  assert.equal(all_confirmed([]), false, 'no run is not three in a row')
})

it('the table names what each side found alone', () => {
  const diff = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit')],
    [
      FIND('https://a.test/1', 8, 'Toolkit'),
      FIND('https://a.test/3', 7, 'PathAI')
    ]
  )
  const lines = compare_lines({
    box: {
      model: 'realness/standard',
      leads: 1,
      problems: 0,
      seconds: 128,
      reads: 53
    },
    mac: {
      model: 'deepseek-v4-flash',
      leads: 2,
      problems: 3,
      seconds: 333,
      reads: 60
    },
    diff
  })
  assert.equal(lines.length, 5)
  assert.match(
    lines[0],
    /^box\s+1 leads\s+0 broken\s+128s\s+53 reads\s+realness\/standard$/
  )
  assert.match(lines[2], /^both {6}Toolkit$/)
  assert.match(lines[3], /^box only {2}none$/)
  assert.match(lines[4], /^mac only {2}PathAI$/)
})

it('a box run is confirmed only when both sides found a lead in common', () => {
  const shared = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit')],
    [FIND('https://a.test/1', 8, 'Toolkit')]
  )
  const apart = compare_finds(
    [FIND('https://a.test/1', 6, 'Toolkit')],
    [FIND('https://a.test/3', 7, 'PathAI')]
  )
  const at = (diff, box, mac) => ({
    box: { model: 'm', leads: box, problems: 0, seconds: 1, reads: 1 },
    mac: { model: 'm', leads: mac, problems: 0, seconds: 1, reads: 1 },
    diff
  })
  assert.equal(confirms(at(shared, 1, 1)), true)
  assert.equal(confirms(at(apart, 1, 1)), false, 'nothing in common')
  assert.equal(confirms(at(shared, 0, 1)), false, 'the box wrote no lead')
  assert.equal(
    confirms(at(compare_finds([], []), 0, 0)),
    true,
    'both found no one'
  )
})
const FIND_PAGE = `<article itemscope itemtype="/find"><dl><dt>url</dt><dd><a itemprop="url" href="https://a.test/1">a</a></dd><dt>title</dt><dd><span itemprop="title">A</span></dd><dt>org</dt><dd><span itemprop="org">Toolkit</span></dd><dt>source</dt><dd><span itemprop="source">VueJobs</span></dd><dt>score</dt><dd><span itemprop="score">8</span></dd><dt>reason</dt><dd><span itemprop="reason">ownership and Vue work</span></dd></dl></article>`

it('a side that wrote no finds says why, and the table says it failed', async () => {
  const { read_side } = await import('../../scripts/scout-compare.js')
  const good = read_side({
    html: FIND_PAGE,
    steps: '',
    model: 'm',
    seconds: 10
  })
  assert.equal(good.leads, 1)
  assert.equal(good.failed, undefined)
  const bad = read_side({
    html: '',
    steps: '',
    model: 'm',
    seconds: 10,
    output: 'failed: pi exited 143'
  })
  assert.equal(bad.leads, 0)
  assert.match(bad.failed, /pi exited 143/)
  const lines = compare_lines({
    box: bad,
    mac: good,
    diff: compare_finds([], good.found)
  })
  assert.match(lines[0], /^box {2}failed: /)
  assert.equal(
    confirms({ box: bad, mac: good, diff: compare_finds([], good.found) }),
    false
  )
})

it('a comparison saves the box leads into the plan, dropping a repeat', async t => {
  const plan = mkdtempSync(out_path('compare-plan-'))
  t.after(() => rmSync(plan, { recursive: true, force: true }))
  mkdirSync(join(plan, 'Finds'), { recursive: true })
  writeFileSync(join(plan, 'index.md'), '# plan\n\n### Finds\n')
  writeFileSync(
    join(plan, 'Finds', 'finds.html'),
    '<article itemscope itemtype="/find"><dl>' +
      '<dt>url</dt><dd><a itemprop="url" href="https://a.test/1">1</a></dd>' +
      '<dt>score</dt><dd><span itemprop="score">6</span></dd>' +
      '</dl></article>'
  )
  const saved = await save_box_leads({
    plan_dir: plan,
    label: 'plan',
    source: 'vuejobs',
    leads: [
      { url: 'https://a.test/1', title: 'one', org: 'Toolkit', score: 6 },
      { url: 'https://a.test/2', title: 'two', org: 'New', score: 8 }
    ],
    person: '/+1'
  })
  assert.deepEqual(
    saved.fresh.map(lead => lead.url),
    ['https://a.test/2']
  )
  assert.deepEqual(
    saved.repeats.map(lead => lead.url),
    ['https://a.test/1']
  )
  const finds = readFileSync(join(plan, 'Finds', 'finds.html'), 'utf8')
  assert.match(finds, /https:\/\/a\.test\/2/)
  assert.match(finds, /https:\/\/a\.test\/1/)
  const notes = readdirSync(join(plan, 'Leads'))
  assert.equal(notes.length, 1)
  assert.match(notes[0], /vuejobs\.md$/)
  assert.match(readFileSync(join(plan, 'index.md'), 'utf8'), /a\.test\/2/)
})
