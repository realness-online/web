import { describe, it, expect } from 'vitest'
import {
  path_from_url,
  is_bot_ua,
  is_document_hit,
  aggregate_entries,
  aggregate_by_day,
  each_utc_day,
  utc_day,
  referer_host,
  build_logging_filter,
  entry_timestamp,
  entry_id,
  compact_entry,
  cache_bounds,
  marketing_paths,
  classify_referer,
  aggregate_window,
  burst_ips,
  bucket_windows,
  aggregate_trend,
  format_series,
  format_delta
} from '../../../tools/ops/hosting-traffic.js'

/** Minimal hosting log row for the window/trend specs. */
const hit = (path, { ip = '1.1.1.1', ua = 'Mozilla/5.0', referer = '', at } = {}) => ({
  timestamp: at,
  httpRequest: {
    requestMethod: 'GET',
    status: 200,
    requestUrl: `https://realness.online${path}`,
    userAgent: ua,
    remoteIp: ip,
    referer
  }
})

const window_opts = {
  host: 'realness.online',
  include_bots: false,
  all_paths: false
}

describe('path_from_url', () => {
  it('strips query, hash, and trailing slash', () => {
    expect(path_from_url('https://realness.online/about/?utm=x#y')).toBe(
      '/about'
    )
    expect(path_from_url('https://realness.online/')).toBe('/')
  })
})

describe('is_bot_ua', () => {
  it('detects common crawlers', () => {
    expect(is_bot_ua('Twitterbot/1.0')).toBe(true)
    expect(is_bot_ua('Mozilla/5.0 (Macintosh) Safari/605')).toBe(false)
  })
})

describe('is_document_hit', () => {
  const base = {
    requestMethod: 'GET',
    status: 200,
    requestUrl: 'https://realness.online/about'
  }

  it('keeps marketing GETs', () => {
    expect(
      is_document_hit(base, { host: 'realness.online', all_paths: false })
    ).toBe(true)
  })

  it('drops assets even with all_paths', () => {
    expect(
      is_document_hit(
        { ...base, requestUrl: 'https://realness.online/assets/app.js' },
        { host: 'realness.online', all_paths: true }
      )
    ).toBe(false)
  })
})

describe('aggregate_entries', () => {
  it('splits bots and humans and tallies referrers', () => {
    const entries = [
      {
        httpRequest: {
          requestMethod: 'GET',
          status: 200,
          requestUrl: 'https://realness.online/about',
          userAgent: 'Mozilla/5.0',
          remoteIp: '1.1.1.1',
          referer: 'https://t.co/abc'
        }
      },
      {
        httpRequest: {
          requestMethod: 'GET',
          status: 200,
          requestUrl: 'https://realness.online/about',
          userAgent: 'Twitterbot/1.0',
          remoteIp: '2.2.2.2',
          referer: ''
        }
      }
    ]

    const report = aggregate_entries(entries, {
      host: 'realness.online',
      include_bots: false,
      all_paths: false
    })

    expect(report.matched).toBe(2)
    expect(report.bots).toBe(1)
    expect(report.paths[0]).toMatchObject({
      path: '/about',
      hits: 2,
      bots: 1,
      humans: 1,
      approx_visitors: 1
    })
    expect(report.top_referers[0]).toEqual({ host: 't.co', count: 1 })
  })
})

describe('referer_host', () => {
  it('labels empty referers', () => {
    expect(referer_host('')).toBe('(none)')
    expect(referer_host('https://news.ycombinator.com/item?id=1')).toBe(
      'news.ycombinator.com'
    )
  })
})

describe('build_logging_filter', () => {
  it('scopes marketing mode to document paths', () => {
    const filter = build_logging_filter({
      host: 'realness.online',
      since: '2026-01-01T00:00:00.000Z'
    })
    expect(filter).toContain('resource.type="firebase_domain"')
    expect(filter).toContain('httpRequest.requestUrl=~"')
    expect(filter).toContain('about')
  })

  it('uses host substring match for all_paths', () => {
    const filter = build_logging_filter({
      host: 'realness.online',
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-01-02T00:00:00.000Z',
      all_paths: true
    })
    expect(filter).toContain('httpRequest.requestUrl:"realness.online"')
    expect(filter).toContain('timestamp<"2026-01-02T00:00:00.000Z"')
  })
})

describe('entry identity', () => {
  it('prefers insertId and compacts httpRequest', () => {
    const entry = {
      insertId: 'abc',
      timestamp: '2026-07-01T12:00:00.000Z',
      httpRequest: {
        requestMethod: 'GET',
        requestUrl: 'https://realness.online/about',
        status: 200
      }
    }
    expect(entry_id(entry)).toBe('abc')
    expect(compact_entry(entry)).toEqual({
      insertId: 'abc',
      timestamp: '2026-07-01T12:00:00.000Z',
      httpRequest: entry.httpRequest
    })
  })

  it('reads protobuf-ish timestamps', () => {
    expect(
      entry_timestamp({ timestamp: { seconds: 1_720_000_000 } })
    ).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('cache_bounds', () => {
  it('finds oldest and newest', () => {
    expect(
      cache_bounds([
        { timestamp: '2026-07-02T00:00:00.000Z', httpRequest: null },
        { timestamp: '2026-07-01T00:00:00.000Z', httpRequest: null }
      ])
    ).toEqual({
      oldest: '2026-07-01T00:00:00.000Z',
      newest: '2026-07-02T00:00:00.000Z'
    })
  })
})

describe('marketing_paths', () => {
  it('includes core public pages', () => {
    expect(marketing_paths.has('/about')).toBe(true)
    expect(marketing_paths.has('/pricing')).toBe(true)
  })
})

describe('aggregate_by_day', () => {
  it('buckets human hits for funnel paths', () => {
    expect(utc_day('2026-07-21T15:00:00.000Z')).toBe('2026-07-21')
    expect(
      each_utc_day('2026-07-21T12:00:00.000Z', '2026-07-22T08:00:00.000Z')
    ).toEqual(['2026-07-21', '2026-07-22'])

    const rows = aggregate_by_day(
      [
        {
          timestamp: '2026-07-21T10:00:00.000Z',
          httpRequest: {
            requestMethod: 'GET',
            status: 200,
            requestUrl: 'https://realness.online/about',
            userAgent: 'Mozilla/5.0',
            remoteIp: '1.1.1.1'
          }
        },
        {
          timestamp: '2026-07-21T11:00:00.000Z',
          httpRequest: {
            requestMethod: 'GET',
            status: 200,
            requestUrl: 'https://realness.online/pricing',
            userAgent: 'Mozilla/5.0',
            remoteIp: '1.1.1.1'
          }
        },
        {
          timestamp: '2026-07-21T12:00:00.000Z',
          httpRequest: {
            requestMethod: 'GET',
            status: 200,
            requestUrl: 'https://realness.online/about',
            userAgent: 'Twitterbot/1.0',
            remoteIp: '2.2.2.2'
          }
        }
      ],
      {
        host: 'realness.online',
        include_bots: false,
        all_paths: false,
        since: '2026-07-21T00:00:00.000Z'
      }
    )

    const day = rows.find(row => row.day === '2026-07-21')
    expect(day?.paths['/about']).toEqual({ humans: 1, approx_visitors: 1 })
    expect(day?.paths['/pricing']).toEqual({ humans: 1, approx_visitors: 1 })
    expect(day?.paths['/'].humans).toBe(0)
  })
})

describe('classify_referer', () => {
  it('separates discovery from our own links', () => {
    expect(classify_referer('', 'realness.online')).toBe('direct')
    expect(
      classify_referer('https://realness.online/about', 'realness.online')
    ).toBe('internal')
    expect(
      classify_referer('https://www.realness.online/', 'realness.online')
    ).toBe('internal')
    expect(classify_referer('https://www.google.com/', 'realness.online')).toBe(
      'external'
    )
  })
})

describe('aggregate_window', () => {
  it('counts outside arrivals and splits landed from deeper', () => {
    const result = aggregate_window(
      [
        hit('/', { referer: 'https://www.google.com/' }),
        hit('/', { ip: '2.2.2.2' }),
        hit('/about', { ip: '2.2.2.2', referer: 'https://realness.online/' }),
        hit('/docs', { ip: '2.2.2.2', referer: 'https://realness.online/about' }),
        hit('/about', { ip: '9.9.9.9', ua: 'Twitterbot/1.0' })
      ],
      window_opts
    )

    expect(result.outside).toBe(1)
    expect(result.direct).toBe(1)
    expect(result.internal).toBe(0)
    expect(result.bots).toBe(1)
    expect(result.landed).toBe(2)
    expect(result.deeper).toBe(1)
    expect(result.sources).toEqual([{ host: 'www.google.com', count: 1 }])
  })

  it('credits a visitor to where they first arrived from', () => {
    const result = aggregate_window(
      [
        hit('/about', {
          at: '2026-08-29T12:00:05Z',
          referer: 'https://realness.online/'
        }),
        hit('/', {
          at: '2026-08-29T12:00:00Z',
          referer: 'https://www.google.com/'
        })
      ],
      window_opts
    )

    expect(result.outside).toBe(1)
    expect(result.internal).toBe(0)
    expect(result.sources).toEqual([{ host: 'www.google.com', count: 1 }])
  })

  it('ignores a referer that is a scanner payload, not a URL', () => {
    const result = aggregate_window(
      [
        hit('/', {
          referer: '() { ignored; }; echo Content-Type: text/html; /bin/cat /etc/passwd'
        })
      ],
      window_opts
    )

    expect(result.sources).toEqual([])
    expect(result.outside).toBe(0)
    expect(result.direct).toBe(1)
  })

  it('leaves deep-link arrivals out of deeper', () => {
    const result = aggregate_window(
      [
        hit('/', { ip: '2.2.2.2' }),
        hit('/about', { ip: '2.2.2.2', referer: 'https://realness.online/' }),
        hit('/about', { ip: '3.3.3.3', referer: 'https://elsewhere.test/' })
      ],
      window_opts
    )

    expect(result.landed).toBe(1)
    expect(result.deeper).toBe(1)
  })

  it('holds out one address that dominates the period', () => {
    const entries = [
      ...Array.from({ length: 40 }, (_, i) =>
        hit('/', {
          ip: '195.178.110.101',
          ua: `Mozilla/5.0 (fake ${i})`,
          referer: 'https://news.ycombinator.com/'
        })
      ),
      hit('/', { ip: '8.8.8.8', referer: 'https://www.google.com/' })
    ]

    const result = aggregate_window(entries, window_opts)
    expect(result.burst_ips).toEqual(['195.178.110.101'])
    expect(result.burst_hits).toBe(40)
    expect(result.outside).toBe(1)
    expect(result.landed).toBe(1)
    expect(result.sources).toEqual([{ host: 'www.google.com', count: 1 }])
  })

  it('leaves a quiet period alone', () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      hit('/', { ip: `5.5.5.${i}` })
    )
    const result = aggregate_window(entries, window_opts)
    expect(result.burst_ips).toEqual([])
    expect(result.landed).toBe(6)
  })

  it('ignores bots unless asked for them', () => {
    const entries = [hit('/', { ua: 'GPTBot/1.0', referer: 'https://x.com/' })]
    expect(aggregate_window(entries, window_opts).outside).toBe(0)
    expect(
      aggregate_window(entries, { ...window_opts, include_bots: true }).outside
    ).toBe(1)
  })
})

describe('burst_ips', () => {
  const flagged = (counts, total) => [...burst_ips(new Map(counts), total)]

  it('needs both volume and share to flag', () => {
    expect(flagged([['a', 4]], 10)).toEqual([])
    expect(flagged([['a', 30]], 1000)).toEqual([])
    expect(flagged([['a', 40], ['b', 10]], 50)).toEqual(['a'])
  })

  it('flags nothing in an empty period', () => {
    expect(flagged([], 0)).toEqual([])
  })
})

describe('bucket_windows', () => {
  it('returns consecutive periods, oldest first, ending at now', () => {
    const windows = bucket_windows('2026-07-26T00:00:00.000Z', 7, 3)
    expect(windows).toHaveLength(3)
    expect(windows[0].start).toBe('2026-07-05T00:00:00.000Z')
    expect(windows[2].end).toBe('2026-07-26T00:00:00.000Z')
    expect(windows[0].end).toBe(windows[1].start)
  })
})

describe('aggregate_trend', () => {
  const rows = [
    hit('/', { at: '2026-07-24T00:00:00.000Z', referer: 'https://x.com/' }),
    hit('/', { at: '2026-07-15T00:00:00.000Z', ip: '3.3.3.3' }),
    hit('/', { at: '2026-07-15T01:00:00.000Z', ip: '4.4.4.4' })
  ]

  it('buckets rows into periods', () => {
    const trend = aggregate_trend(rows, {
      ...window_opts,
      days: 7,
      buckets: 3,
      now: '2026-07-26T00:00:00.000Z',
      oldest: '2026-07-05T00:00:00.000Z'
    })

    expect(trend.map(period => period.landed)).toEqual([0, 2, 1])
    expect(trend[2].outside).toBe(1)
    expect(trend.every(period => period.covered)).toBe(true)
  })

  it('marks periods the archive does not reach as uncovered', () => {
    const trend = aggregate_trend(rows, {
      ...window_opts,
      days: 7,
      buckets: 3,
      now: '2026-07-26T00:00:00.000Z',
      oldest: '2026-07-14T00:00:00.000Z'
    })

    expect(trend.map(period => period.covered)).toEqual([false, false, true])
  })
})

describe('format_series', () => {
  it('right-aligns periods to a common width', () => {
    expect(format_series([7, 1, 0, 1])).toBe('  7    1    0    1')
    expect(format_series([127, 80, 30, 30])).toBe('127   80   30   30')
  })

  it('prints unknown periods as a dash', () => {
    expect(format_series([null, null, 4])).toBe('  -    -    4')
  })
})

describe('format_delta', () => {
  it('signs the change and dashes an unknown baseline', () => {
    expect(format_delta(10, 14)).toBe('-4')
    expect(format_delta(14, 10)).toBe('+4')
    expect(format_delta(10, 10)).toBe('0')
    expect(format_delta(10, null)).toBe('-')
  })
})
