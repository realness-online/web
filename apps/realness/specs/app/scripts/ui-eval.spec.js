import { describe, expect, it } from 'vite-plus/test'
import {
  added_lines,
  compare_html,
  changed_enough,
  judge_many,
  median,
  pixel_diff,
  report_html,
  scope_of,
  settle,
  starter_of,
  tells_in
} from '../../../scripts/ui-eval.js'

const diff = `diff --git a/src/a.vue b/src/a.vue
--- a/src/a.vue
+++ b/src/a.vue
@@ -1,2 +1,3 @@
-<p>Old</p>
+<p>Alex · Brake</p>
+<a>Next →</a>
 <p>Same</p>
diff --git a/src/b.styl b/src/b.styl
--- a/src/b.styl
+++ b/src/b.styl
@@ -1 +1,2 @@
+  color: #ff0044
+  text-transform: uppercase
`

describe('ui-eval', () => {
  it('keeps the script and drops the markup and styles', () => {
    const source = `<script setup>
const count = 2
</script>

<template>
  <section data-page><h1>Thoughts</h1><p>{{ count }}</p></section>
</template>

<style lang="stylus">
  section
    color: red
</style>
`
    const starter = starter_of(source, 'Thoughts')
    expect(starter).toContain('const count = 2')
    expect(starter).toContain('<h1>Thoughts</h1>')
    expect(starter).not.toContain('data-page')
    expect(starter).not.toContain('color: red')
    expect(() => starter_of('<template></template>', 'x')).toThrow(
      'no script block'
    )
  })

  it('reads only added lines', () => {
    expect(added_lines(diff)).toEqual([
      '<p>Alex · Brake</p>',
      '<a>Next →</a>',
      '  color: #ff0044',
      '  text-transform: uppercase'
    ])
  })

  it('counts files and changed lines', () => {
    expect(scope_of(diff)).toEqual({ files: 2, lines: 5 })
  })

  it('finds template tells and new colors', () => {
    expect(tells_in(added_lines(diff))).toEqual({
      uppercase: 1,
      middle_dot: 1,
      arrow: 1,
      numbered: 0,
      new_color: 1
    })
  })

  it('takes the middle rank and the majority verdict', async () => {
    expect(median([3, 1, 2])).toBe(2)
    const says = ranks => (task, before, results) =>
      Promise.resolve(
        Object.fromEntries(
          results.map(({ arm }, at) => [
            arm,
            { rank: ranks[at], better: ranks[at] === 1, note: `${arm} n` }
          ])
        )
      )
    const results = [{ arm: 'a' }, { arm: 'b' }]
    const one = await judge_many({
      task: {},
      before: {},
      results,
      out: '/out',
      times: 2,
      call: says([1, 2])
    })
    expect(one.a).toMatchObject({ rank: 1, ranks: [1, 1], better: true })
    expect(one.b).toMatchObject({ rank: 2, ranks: [2, 2], better: false })
    const split = await judge_many({
      task: {},
      before: {},
      results,
      out: '/out',
      times: 2,
      call: says([0, 1])
    })
    expect(split.a.rank).toBeUndefined()
  })

  it('ignores antialiasing and counts a real change', () => {
    const left = Buffer.alloc(40 * 4)
    const right = Buffer.alloc(40 * 4)
    right[0] = 2
    right[4] = 200
    expect(pixel_diff(left, right)).toEqual({ pixels: 1, total: 40 })
    expect(changed_enough({ pixels: 1, total: 40 })).toBe(false)
    expect(changed_enough({ pixels: 50, total: 100_000 })).toBe(false)
    expect(changed_enough({ pixels: 200, total: 100_000 })).toBe(true)
  })

  it('never ranks a page with no visible change', () => {
    const states = [
      {
        width: 390,
        overflow: false,
        broken: false,
        low_contrast: 0,
        small_targets: 0,
        errors: 0
      }
    ]
    const list = [
      { arm: 'none', states, visible: false, rank: 1, better: true, note: '' },
      {
        arm: 'user-experience',
        states,
        visible: true,
        rank: 2,
        better: true,
        note: ''
      }
    ]
    settle(list)
    expect(list[0]).toMatchObject({ rank: undefined, better: false })
    expect(list[0].note).toContain('No visible change')
    expect(list[1]).toMatchObject({ rank: 1, better: true })
  })

  it('never ranks a page that did not render above one that did', () => {
    const states = broken => [
      {
        width: 390,
        overflow: false,
        broken,
        low_contrast: 6,
        small_targets: 6,
        errors: 0
      }
    ]
    const list = [
      {
        arm: 'none',
        states: states(false),
        rank: 2,
        better: false,
        note: 'smaller'
      },
      {
        arm: 'flawless-ui-ux',
        states: states(true),
        rank: 1,
        better: true,
        note: 'nicer'
      }
    ]
    settle(list)
    expect(list[1]).toMatchObject({ rank: 2, better: false })
    expect(list[0]).toMatchObject({ rank: 1, better: false })
    expect(list[1].note).toContain(
      'Did not render (Vite error overlay) at 390 wide'
    )
    expect(list[0].note).toBe('smaller')
  })

  it('measures each run against the original, not in the abstract', () => {
    const states = [
      {
        width: 390,
        overflow: false,
        low_contrast: 8,
        small_targets: 3,
        errors: 0
      }
    ]
    const row = {
      scope: { files: 0, lines: 0 },
      check_ok: true,
      tells: {},
      states,
      seconds: 1,
      note: '',
      shots: [],
      reply: '',
      diff: ''
    }
    const html = report_html(
      'now',
      'm',
      [{ ...row, task: 'chat', arm: 'none' }],
      {
        chat: { states: [{ ...states[0], low_contrast: 5, small_targets: 4 }] }
      }
    )
    expect(html).toContain('390: 8 (+3)')
    expect(html).toContain('390: 3 (-1)')
  })

  it('names a column for every cell in the row', () => {
    const row = {
      scope: { files: 1, lines: 2 },
      check_ok: true,
      tells: {},
      states: [
        {
          width: 390,
          overflow: false,
          broken: false,
          low_contrast: 0,
          small_targets: 0,
          errors: 0
        }
      ],
      seconds: 9,
      note: '',
      shots: [],
      reply: '',
      diff: ''
    }
    const html = report_html('now', 'm', [
      { ...row, task: 'chat', arm: 'none' }
    ])
    const heads =
      html.match(/<thead>([\s\S]*?)<\/thead>/)[1].match(/<th>[^<]+<\/th>/g) ??
      []
    const first_row = html.match(/<tr itemscope[^>]*>([\s\S]*?)<\/tr>/)[1]
    const cells = first_row.match(/<t[dh][\s>]/g) ?? []
    expect(heads).toHaveLength(cells.length)
    expect(heads.slice(0, 7)).toEqual([
      '<th>Arm</th>',
      '<th>Rank</th>',
      '<th>Better</th>',
      '<th>Files</th>',
      '<th>Lines</th>',
      '<th>Lint</th>',
      '<th>Page</th>'
    ])
  })

  it('reports each run as an item, best rank first', () => {
    const row = {
      scope: { files: 1, lines: 2 },
      check_ok: true,
      tells: { arrow: 1 },
      states: [
        {
          width: 390,
          overflow: false,
          low_contrast: 0,
          small_targets: 2,
          errors: 0
        }
      ],
      seconds: 9,
      note: 'Clear <b>',
      shots: ['/x/chat-none-390.png'],
      reply: '',
      diff: ''
    }
    const html = report_html('now', 'm', [
      { ...row, task: 'chat', arm: 'none', rank: 2 },
      { ...row, task: 'chat', arm: 'user-experience', rank: 1 }
    ])
    expect(html.indexOf('user-experience')).toBeLessThan(html.indexOf('>none<'))
    expect(html).toContain('itemtype="https://schema.org/CreativeWork"')
    expect(html).toContain('Clear &lt;b&gt;')
    expect(html).toContain('src="chat-none-390.png"')
  })

  const state = (width, extra = {}) => ({
    width,
    overflow: false,
    broken: false,
    low_contrast: 0,
    small_targets: 0,
    errors: 0,
    ...extra
  })

  const row = (over = {}) => ({
    task: 'chat',
    arm: 'none',
    scope: { files: 1, lines: 2 },
    check_ok: true,
    tells: { arrow: 1 },
    states: [state(390), state(1440)],
    seconds: 9,
    note: '',
    shots: ['/x/chat-none-390.png', '/x/chat-none-1440.png'],
    reply: '',
    diff: '',
    ...over
  })

  it('counts each measurement against the starter for the same width', () => {
    const html = report_html(
      'now',
      'm',
      [
        row({
          states: [
            state(390, { overflow: true, low_contrast: 5, errors: 2 }),
            state(1440)
          ]
        })
      ],
      {
        chat: { states: [state(390, { low_contrast: 3 }), state(800)] }
      }
    )
    expect(html).toContain('390: 5 (+2)')
    expect(html).toContain('390: 2 (+2)')
    expect(html).toContain('390: yes')
    expect(html).toContain('1440: 0')
  })

  it('names a leftover trial rank and a lint failure, and dashes the rest', () => {
    const html = report_html('now', '', [
      row({ rank: 2, ranks: [1, 2, 3], check_ok: false, visible: false }),
      row({
        arm: 'blank',
        rank: undefined,
        better: undefined,
        visible: undefined
      })
    ])
    expect(html).toContain('<small> 1, 2, 3</small>')
    expect(html).toContain('fail')
    expect(html).toContain('default')
    expect(html).toMatch(/<td>-<\/td>/)
  })

  it('says which width a page broke at, and ranks it last', () => {
    const list = [
      row({ rank: 1 }),
      row({
        arm: 'broken',
        states: [state(390, { broken: true }), state(1440, { broken: true })]
      })
    ]
    settle(list)
    expect(list[1].rank).toBe(2)
    expect(list[1].note).toContain('at 390 and 1440 wide')
    expect(list[1].note).toContain('Did not render')
  })

  it('leaves an unchanged page unranked with a note', () => {
    const list = [row({ arm: 'same', visible: false, rank: 3 })]
    settle(list)
    expect(list[0].rank).toBeUndefined()
    expect(list[0].better).toBe(false)
    expect(list[0].note).toContain('No visible change')
  })

  it('draws the current page and the blank starter beside every proposal', () => {
    const html = compare_html(
      [
        row({ arm: 'current' }),
        row({ arm: 'blank' }),
        row({ arm: 'slow', rank: 2 }),
        row({ arm: 'fast', rank: 1 })
      ],
      'now'
    )
    expect(html).toContain('Current page, done by hand')
    expect(html).toContain('Blank starter, what every arm began with')
    expect(html).toContain('class="current"')
    expect(html.indexOf('fast')).toBeLessThan(html.indexOf('slow'))
    expect(html).toContain('chat fast 1440')
  })

  it('leaves an empty cell where a row has no screenshot at that width', () => {
    const html = compare_html([row({ shots: ['/x/chat-none-390.png'] })], 'now')
    expect(html).toContain('chat none 390')
    expect(html).not.toContain('chat none 1440')
  })

  it('reads tells and colors from the added lines only', () => {
    expect(tells_in([]).arrow).toBe(0)
    const tells = tells_in([
      '<p>Next →</p>',
      '<p>One · Two</p>',
      '<span style="color: #112233"></span>',
      '<p> 01 </p>',
      '<p>Plain</p>'
    ])
    expect(tells.arrow).toBe(1)
    expect(tells.middle_dot).toBe(1)
    expect(tells.new_color).toBe(1)
    expect(tells.numbered).toBe(1)
    expect(tells.uppercase).toBe(0)
  })

  it('takes the middle of an even or odd list of ranks', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2)
  })

  it('counts a diff with no added lines as no change', () => {
    expect(added_lines('')).toEqual([])
    expect(scope_of('')).toEqual({ files: 0, lines: 0 })
  })

  it('leaves the verdict open when the judgments split', async () => {
    const call = async (task, before, results, out, attempt) =>
      attempt === 0
        ? { none: { better: true, note: 'first' } }
        : { none: { better: false, note: 'second' } }
    const verdict = await judge_many({
      task: { name: 'chat' },
      before: {},
      results: [{ arm: 'none' }],
      out: '/x',
      times: 2,
      call
    })
    expect(verdict.none.better).toBeUndefined()
    expect(verdict.none.rank).toBeUndefined()
    expect(verdict.none.note).toBe('first')
  })

  it('measures only pixels that moved past the tolerance', () => {
    const flat = Buffer.alloc(4 * 10, 0)
    const one = Buffer.from(flat)
    one[4] = 200
    expect(pixel_diff(flat, flat)).toEqual({ pixels: 0, total: 10 })
    expect(pixel_diff(flat, one)).toEqual({ pixels: 1, total: 10 })
    expect(changed_enough({ pixels: 1, total: 10 })).toBe(false)
    expect(changed_enough({ pixels: 5, total: 10 })).toBe(false)
    expect(changed_enough({ pixels: 120, total: 1000 })).toBe(true)
  })

  it('draws no figure for an empty run', () => {
    const html = compare_html([], 'now')
    expect(html).toContain('UI skill eval, side by side')
    expect(html).not.toContain('<figure')
  })
})
