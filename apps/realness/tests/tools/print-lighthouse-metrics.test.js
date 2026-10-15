import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  format_ms,
  format_timed,
  get_thoughts_render_ms,
  median
} from '../../frontend/scripts/print-lighthouse-metrics.js'

describe('median', () => {
  it('takes the middle of an odd count and the mean of the middle pair', () => {
    assert.equal(median([5]), 5)
    assert.equal(median([1, 3, 2]), 2)
    assert.equal(median([1, 2, 3, 4]), 2.5)
  })

  it('answers null for nothing, so a missing measurement reads as n/a', () => {
    assert.equal(median([]), null)
    assert.equal(format_ms(median([])), 'n/a')
    assert.equal(format_timed(median([]), median([])), 'n/a')
  })

  it('does not reorder the array it is given', () => {
    const values = [3, 1, 2]
    median(values)
    assert.deepEqual(values, [3, 1, 2])
  })
})

describe('format_ms', () => {
  it('rounds a number and names a missing one', () => {
    assert.equal(format_ms(12.4), '12ms')
    assert.equal(format_ms(12.6), '13ms')
    assert.equal(format_ms(0), '0ms')
    assert.equal(format_ms(null), 'n/a')
  })
})

describe('format_timed', () => {
  it('names what is missing on either side', () => {
    assert.equal(format_timed(null, null), 'n/a')
    assert.equal(format_timed(100, null), '100ms')
    assert.equal(format_timed(null, 200), 'obs 200ms')
    assert.equal(format_timed(100, 200), '100ms (obs 200ms)')
  })
})

describe('get_thoughts_render_ms', () => {
  it('finds the thoughts timing whatever its key is called', () => {
    const items = [
      { name: 'other', duration: 5 },
      { name: 'thoughts-rendered', duration: 123.4 }
    ]
    assert.equal(get_thoughts_render_ms(items), 123.4)
    assert.equal(
      get_thoughts_render_ms([{ label: 'Thoughts-Rendered', startTime: 88 }]),
      88
    )
  })

  it('answers null when the page has no such timing', () => {
    assert.equal(get_thoughts_render_ms([]), null)
    assert.equal(get_thoughts_render_ms([{ name: 'other', duration: 5 }]), null)
    assert.equal(
      get_thoughts_render_ms([{ name: 'thoughts-rendered', duration: 'slow' }]),
      null
    )
  })
})
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after } from 'node:test'
import {
  get_lhr_paths,
  report
} from '../../frontend/scripts/print-lighthouse-metrics.js'

const scratch = resolve(
  import.meta.dirname,
  '../../../artifacts/lighthouse-metrics-spec'
)
after(() => rmSync(scratch, { recursive: true, force: true }))

/** One Lighthouse report file for a page. */
const lhr = ({
  score = 0.9,
  fcp = 1000,
  lcp = 2000,
  observed_fcp = null,
  observed_lcp = null,
  thoughts = null
} = {}) => ({
  categories: { performance: { score } },
  audits: {
    'first-contentful-paint': { numericValue: fcp },
    'largest-contentful-paint': { numericValue: lcp },
    metrics: {
      details: {
        items: [
          {
            observedFirstContentfulPaint: observed_fcp,
            observedLargestContentfulPaint: observed_lcp
          }
        ]
      }
    },
    'user-timings': {
      details: {
        items:
          thoughts === null
            ? []
            : [{ name: 'thoughts-rendered', duration: thoughts }]
      }
    }
  }
})

const write_runs = (name, reports) => {
  const dir = join(scratch, name)
  mkdirSync(dir, { recursive: true })
  reports.forEach((one, index) =>
    writeFileSync(
      join(dir, `lhr-${String(index).padStart(3, '0')}.json`),
      JSON.stringify(one)
    )
  )
  return dir
}

const capture = fn => {
  const said = []
  const errors = []
  const info = console.info
  const error = console.error
  console.info = message => said.push(String(message))
  console.error = message => errors.push(String(message))
  try {
    return { code: fn(), said: said.join('\n'), errors: errors.join('\n') }
  } finally {
    console.info = info
    console.error = error
  }
}

describe('get_lhr_paths', () => {
  it('reads only lhr json files, sorted, at most the last five runs', () => {
    const dir = write_runs('selection', [
      lhr(),
      lhr(),
      lhr(),
      lhr(),
      lhr(),
      lhr(),
      lhr()
    ])
    writeFileSync(join(dir, 'manifest.json'), '{}')
    writeFileSync(join(dir, 'notes.txt'), 'x')
    const paths = get_lhr_paths(dir)
    assert.equal(paths.length, 5, 'the newest five runs')
    assert.ok(
      paths.every(path => path.includes('lhr-') && path.endsWith('.json'))
    )
    assert.deepEqual(paths, [...paths].sort(), 'sorted by name')
  })

  it('answers nothing for a directory with no reports', () => {
    const dir = join(scratch, 'empty')
    mkdirSync(dir, { recursive: true })
    assert.deepEqual(get_lhr_paths(dir), [])
  })
})

describe('report', () => {
  it('says no report was found when the directory is missing, and fails', () => {
    const result = capture(() => report(join(scratch, 'not-there')))
    assert.equal(result.code, 1)
    assert.match(result.errors, /No Lighthouse report found/)
  })

  it('says no report was found when the directory has no reports', () => {
    const dir = join(scratch, 'none')
    mkdirSync(dir, { recursive: true })
    const result = capture(() => report(dir))
    assert.equal(result.code, 1)
    assert.match(result.errors, /No Lighthouse report found/)
  })

  it('prints one line per run with rounded scores and both timings', () => {
    const dir = write_runs('one', [
      lhr({
        score: 0.876,
        fcp: 1234,
        lcp: 2345,
        observed_fcp: 1200,
        observed_lcp: 2300,
        thoughts: 456
      })
    ])
    const result = capture(() => report(dir))
    assert.equal(result.code, 0)
    assert.match(
      result.said,
      /Run 1: Performance 88 \| FCP 1234ms \(obs 1200ms\) \| LCP 2345ms \(obs 2300ms\) \| Thoughts rendered 456ms/
    )
    assert.doesNotMatch(result.said, /Median/, 'one run has no median')
  })

  it('names what a run did not measure', () => {
    const dir = write_runs('missing', [{ categories: {}, audits: {} }])
    const result = capture(() => report(dir))
    assert.equal(result.code, 0)
    assert.match(
      result.said,
      /Run 1: Performance n\/a \| FCP n\/a \| LCP n\/a \| Thoughts rendered n\/a/
    )
  })

  it('reports an observed time with no throttled one', () => {
    const dir = write_runs('observed', [lhr({ fcp: null, observed_fcp: 1500 })])
    const result = capture(() => report(dir))
    assert.match(result.said, /FCP obs 1500ms/)
  })

  it('prints a median line once there is more than one run', () => {
    const dir = write_runs('many', [
      lhr({
        score: 0.8,
        fcp: 1000,
        lcp: 2000,
        observed_fcp: 900,
        observed_lcp: 1900,
        thoughts: 100
      }),
      lhr({
        score: 0.9,
        fcp: 3000,
        lcp: 4000,
        observed_fcp: 2900,
        observed_lcp: 3900,
        thoughts: 300
      })
    ])
    const result = capture(() => report(dir))
    assert.equal(result.code, 0)
    assert.match(result.said, /Run 1:/)
    assert.match(result.said, /Run 2:/)
    assert.match(
      result.said,
      /Median \(2 runs\): Performance 85 \| FCP 2000ms \(obs 1900ms\) \| LCP 3000ms \(obs 2900ms\) \| Thoughts rendered 200ms/
    )
  })

  it('takes the median of the runs that measured a number', () => {
    const dir = write_runs('some-missing', [
      lhr({ score: 0.9, fcp: 1000, lcp: 2000, thoughts: 100 }),
      lhr({ score: null, fcp: null, lcp: null, thoughts: 300 }),
      lhr({ score: 0.7, fcp: 3000, lcp: 4000, thoughts: null })
    ])
    const result = capture(() => report(dir))
    // No run measured an observed time, so the median line omits it rather than printing NaN.
    assert.match(
      result.said,
      /Median \(3 runs\): Performance 80 \| FCP 2000ms \| LCP 3000ms \| Thoughts rendered 200ms/
    )
    assert.doesNotMatch(result.said, /NaN/)
  })
})
