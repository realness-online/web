import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'
import {
  format_ms,
  format_timed,
  get_lhr_paths,
  get_thoughts_render_ms,
  median,
  report
} from '../../scripts/print-lighthouse-metrics.js'

const lhr = (score, fcp, lcp, thoughts) => ({
  categories: { performance: { score } },
  audits: {
    'first-contentful-paint': { numericValue: fcp },
    'largest-contentful-paint': { numericValue: lcp },
    metrics: {
      details: {
        items: [
          {
            observedFirstContentfulPaint: fcp / 2,
            observedLargestContentfulPaint: lcp / 2
          }
        ]
      }
    },
    'user-timings': {
      details: { items: [{ name: 'thoughts-rendered', duration: thoughts }] }
    }
  }
})

let dirs = []
const lhci = runs => {
  mkdir_sync(artifacts_dir, { recursive: true })
  const dir = mkdtemp_sync(join(artifacts_dir, 'lhci-'))
  dirs.push(dir)
  runs.forEach((run, i) =>
    write_file_sync(join(dir, `lhr-${i}.json`), JSON.stringify(run))
  )
  write_file_sync(join(dir, 'manifest.json'), '[]')
  return dir
}

afterEach(() => {
  for (const dir of dirs) rm_sync(dir, { recursive: true, force: true })
  dirs = []
  vi.restoreAllMocks()
})

describe('print-lighthouse-metrics', () => {
  it('takes the median of odd and even lists', () => {
    expect(median([])).toBe(null)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('formats throttled and observed timings', () => {
    expect(format_ms(null)).toBe('n/a')
    expect(format_ms(12.6)).toBe('13ms')
    expect(format_timed(null, null)).toBe('n/a')
    expect(format_timed(10, null)).toBe('10ms')
    expect(format_timed(null, 5)).toBe('obs 5ms')
    expect(format_timed(10, 5)).toBe('10ms (obs 5ms)')
  })

  it('finds the thoughts-rendered timing', () => {
    expect(get_thoughts_render_ms([{ name: 'other', duration: 1 }])).toBe(null)
    expect(
      get_thoughts_render_ms([{ name: 'Thoughts-Rendered', startTime: 42 }])
    ).toBe(42)
  })

  it('keeps only the last five lhr reports', () => {
    const dir = lhci(Array.from({ length: 7 }, () => lhr(1, 1, 1, 1)))
    expect(get_lhr_paths(dir).map(path => path.split('/').at(-1))).toEqual([
      'lhr-2.json',
      'lhr-3.json',
      'lhr-4.json',
      'lhr-5.json',
      'lhr-6.json'
    ])
  })

  it('fails when there is no report', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(report(join(artifacts_dir, 'missing-lhci'))).toBe(1)
    expect(report(lhci([]))).toBe(1)
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('prints each run and the median', () => {
    const lines = []
    vi.spyOn(console, 'info').mockImplementation(line => lines.push(line))
    const dir = lhci([
      lhr(0.9, 1000, 2000, 300),
      lhr(0.8, 1200, 2400, 500),
      lhr(0.7, 1400, 2800, 700)
    ])
    expect(report(dir)).toBe(0)
    expect(lines[0]).toBe(
      'Run 1: Performance 90 | FCP 1000ms (obs 500ms) | LCP 2000ms (obs 1000ms) | Thoughts rendered 300ms'
    )
    expect(lines.at(-1)).toBe(
      'Median (3 runs): Performance 80 | FCP 1200ms (obs 600ms) | LCP 2400ms (obs 1200ms) | Thoughts rendered 500ms'
    )
  })

  it('prints no median for a single run', () => {
    const lines = []
    vi.spyOn(console, 'info').mockImplementation(line => lines.push(line))
    expect(report(lhci([{}]))).toBe(0)
    expect(lines).toEqual([
      'Run 1: Performance n/a | FCP n/a | LCP n/a | Thoughts rendered n/a'
    ])
  })
})
