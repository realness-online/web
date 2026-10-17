import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  braille_line,
  meter,
  pack,
  sparkline
} from '#root/src/command/watch-graph.js'
import { billing_lines, frame } from '#root/src/command/watch-terminal.js'

const BRAILLE = /^[\u2800-\u28ff]+$/

test('braille line fills exact cell dimensions and connects points', () => {
  const rows = braille_line([0, 4, 1, 8, 2], 10, 3)
  assert.equal(rows.length, 3)
  for (const row of rows) {
    assert.equal([...row].length, 10)
    assert.match(row, BRAILLE)
  }
  const columns = Array.from({ length: 10 }, (_, x) =>
    rows.some(row => row.codePointAt(x) !== 0x2800)
  )
  assert.ok(columns.every(Boolean))
})

test('braille line puts the high in the top row and the low in the bottom', () => {
  const [top, bottom] = braille_line([0, 1], 1, 2)
  assert.equal(top.codePointAt(0) & 0x08, 0x08)
  assert.equal(bottom.codePointAt(0) & 0x40, 0x40)
  assert.deepEqual(braille_line([], 3, 2), ['   ', '   '])
  assert.equal(braille_line([5, 5], 2, 1)[0], '\u28c0\u28c0')
})

test('meter clamps and uses eighth blocks', () => {
  assert.equal(meter(0, 4), '····')
  assert.equal(meter(1, 4), '████')
  assert.equal(meter(2, 4), '████')
  assert.equal(meter(0.5, 4), '██··')
  assert.equal(meter(1 / 32, 4), '▏···')
  assert.equal([...meter(0.37, 10)].length, 10)
})

const daily = Array.from({ length: 20 }, (_, at) => ({
  date: `2026-10-${String(at + 1).padStart(2, '0')}`,
  cost: (at % 5) + 0.25
}))
const bill = {
  total: 45,
  through: '2026-10-20T10:00:00Z',
  checked: '2026-10-20T12:00:00Z',
  table: 'p.billing',
  daily,
  rows: [{ net: 45, service: 'Compute Engine', project: 'p' }]
}

test('billing shows numbers and a braille graph without color', () => {
  const lines = billing_lines({ status: 'ok', exports: [bill] }, 60, false)
  const text = lines.join('\n')
  assert.match(text, /LATEST \$4\.25 {3}AVG\/DAY \$2\.25 {3}PEAK \$4\.25 10-05/)
  assert.match(text, /\$4\.25 ┤ [\u2800-\u28ff]+/)
  assert.match(text, /\$0\.25 ┤ [\u2800-\u28ff]+/)
  assert.ok(!text.includes('\x1b['))
})

test('frames with graph and meter fit narrow and wide terminals', () => {
  const snapshot = {
    panels: {
      billing: { status: 'ok', exports: [bill] },
      resources: {
        status: 'ok',
        inventories: [
          {
            project: 'p',
            disks: [],
            instances: [
              { name: 'a', status: 'RUNNING' },
              { name: 'b', status: 'TERMINATED' }
            ]
          }
        ]
      }
    }
  }
  for (const width of [30, 60, 120]) {
    const lines = frame({ snapshot, width, height: 40, on: true })
      .trimEnd()
      .split('\n')
    assert.ok(
      lines.every(
        line => [...line.replace(/\x1b\[[0-9;]*m/g, '')].length <= width
      ),
      `width ${width}`
    )
    assert.ok(
      lines.some(line => /[\u2588-\u258f]/.test(line) && /running/i.test(line))
    )
  }
})

test('wide terminals get a two-column clay dashboard that fills the window', () => {
  const snapshot = {
    panels: {
      billing: { status: 'ok', exports: [bill] },
      services: {
        status: 'ok',
        rows: [{ name: 'a', found: true, ready: true }]
      },
      resources: {
        status: 'ok',
        inventories: [
          {
            project: 'p',
            disks: [],
            instances: [{ name: 'a', status: 'RUNNING' }]
          }
        ]
      }
    }
  }
  for (const [width, height] of [
    [90, 18],
    [140, 40]
  ]) {
    const lines = frame({ snapshot, width, height, on: true })
      .trimEnd()
      .split('\n')
    assert.equal(lines.length, height)
    const plain = lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''))
    for (const line of plain.slice(1, -1)) assert.equal([...line].length, width)
    assert.match(plain[1], /^╭─ CLOUD SPEND .*╮╭─ HEALTH .*╮$/)
    assert.match(plain.at(-2), /^╰─+╯╰─+╯$/)
    assert.ok(lines[1].includes('\x1b[38;2;163;65;69m'))
  }
  const narrow = frame({ snapshot, width: 60, height: 30, on: false })
  assert.ok(!narrow.includes('╮╭'))
})

test('dashboard shows halos, projection, and model tokens from fixtures', () => {
  const gb = 2 ** 30
  const snapshot = {
    panels: {
      billing: { status: 'ok', exports: [bill] },
      halos: {
        rows: [
          {
            name: 'host-a',
            state: 'running',
            age_s: 40,
            actors: { running: 2, idle: 1, stopped: 4 },
            mem_free: 3 * gb,
            mem_total: 8 * gb,
            volume_free: 12 * gb,
            volume_size: 50 * gb
          }
        ]
      },
      cost: {
        rows: [
          {
            day: { cost: 0.42, tokens: 182_000 },
            month: { cost: 11.8, tokens: 4_300_000 },
            daily: []
          }
        ]
      }
    }
  }
  const text = frame({ snapshot, width: 110, height: 30, on: false })
  assert.match(text, /MONTH \$45\.00 {2}→ \$69\.75/)
  assert.match(text, /host-a {2}2 run 1 idle 4 stop {2}40s ago/)
  assert.match(text, /mem \S+ 5\.0\/8G {2}disk \S+ 38\/50G/)
  assert.match(text, /today \$0\.42 182k {2}month \$11\.80 4\.3M/)
})

test('health lights cover halo, sync, proxy, and gate with words', async () => {
  const { health_lights } = await import('#root/src/command/watch-terminal.js')
  const panels = {
    halos: { rows: [{ name: 'h', state: 'quiet' }] },
    services: {
      status: 'ok',
      rows: [
        { name: 'realness-sync', found: true, ready: true },
        { name: 'realness-proxy', found: true, ready: false }
      ]
    }
  }
  const [plain] = health_lights(panels, false)
  assert.equal(plain, '● halo quiet  ● sync ok  ● proxy down  ● gate ?')
  assert.equal(
    health_lights(panels, false, 32)[0],
    'halo quiet sync ok proxy down gate ?'
  )
  const [colored] = health_lights(panels, true)
  assert.match(colored, /\x1b\[31m●\x1b\[0m proxy/)
  assert.doesNotMatch(colored.replace(/\x1b\[[0-9;]*m/g, ''), /quiet|ok|down/)
  assert.equal(health_lights(panels, true).length, 1)
})

test('budget panel lines show cost and budget with projection', async () => {
  const { budget_panel_lines } =
    await import('#root/src/command/watch-terminal.js')
  const panels = {
    billing: {
      status: 'ok',
      exports: [
        {
          total: 44.05,
          through: '2026-10-20T10:00:00Z',
          table: 'p.b',
          daily: [{ date: '2026-10-01', cost: 1 }],
          rows: [{ net: 44.05, service: 'Compute Engine' }]
        }
      ]
    },
    cost: {
      status: 'ok',
      rows: [{ day: { cost: 0.42 }, month: { cost: 11.8 } }]
    },
    plans: { status: 'ok', paying: 2, granted: 1, revenue: 10.0 }
  }
  const lines = budget_panel_lines(panels, 60, false)
  assert.ok(
    lines.some(l => l.includes('MONTH')) || lines.some(l => l.includes('$'))
  )
  assert.ok(lines.some(l => l.includes('→') || l.includes('$44')))
  assert.ok(lines.some(l => l.includes('paying') || l.includes('2')))
})

test('people panel from fixtures', async () => {
  const { people_lines } = await import('#root/src/command/watch-terminal.js')
  const halos = {
    rows: [
      {
        name: 'r-1',
        state: 'running',
        age_s: 120,
        actors: { running: 2, idle: 1, stopped: 0 }
      }
    ]
  }
  const cost = { rows: [{ day: { cost: 3.4 }, month: { cost: 44.05 } }] }
  const lines = people_lines({ halos, cost }, 50, false)
  assert.ok(lines.some(l => l.includes('Active 1/1')))
  assert.ok(lines.some(l => l.includes('2m ago')))
  assert.ok(lines.every(l => [...l.replace(/\[[0-9;]*m/g, '')].length <= 50))
})

test('pack wraps parts onto lines that fit the width', () => {
  assert.deepEqual(pack(['Active 1/2', '3m ago', 'today $1.00'], 20), [
    'Active 1/2  3m ago',
    'today $1.00'
  ])
  assert.deepEqual(pack(['one', 'two'], 80, ' | '), ['one | two'])
})
