import assert from 'node:assert/strict'
import { it } from 'node:test'
import { traffic_summary } from '#root/src/command/watch-traffic.js'
import { frame, traffic_lines } from '#root/src/command/watch-terminal.js'

const now = Date.parse('2026-10-16T12:00:00Z')
const hit = (timestamp, ip, url = 'https://realness.online/', extra = {}) => ({
  insertId: `${timestamp}-${ip}-${url}`,
  timestamp,
  httpRequest: {
    requestMethod: 'GET',
    requestUrl: url,
    status: 200,
    remoteIp: ip,
    userAgent: 'Mozilla/5.0 Safari',
    ...extra
  }
})

it('summary counts people, deeper visits, and outside arrivals per week', () => {
  const rows = [
    hit('2026-10-15T10:00:00Z', '1.1.1.1', 'https://realness.online/', {
      referer: 'https://www.google.com/'
    }),
    hit('2026-10-15T10:01:00Z', '1.1.1.1', 'https://realness.online/about'),
    hit('2026-10-14T10:00:00Z', '2.2.2.2'),
    hit('2026-10-14T11:00:00Z', '3.3.3.3', 'https://realness.online/', {
      userAgent: 'Googlebot'
    }),
    hit('2026-10-05T10:00:00Z', '4.4.4.4'),
    hit('2026-09-20T10:00:00Z', '5.5.5.5')
  ]
  const summary = traffic_summary(rows, { now })
  assert.equal(summary.people, 2)
  assert.equal(summary.deeper, 1)
  assert.equal(summary.outside, 1)
  assert.equal(summary.previous, 1)
  assert.equal(summary.newest, '2026-10-15T10:01:00Z')
})

it('days before the archive are unknown, not zero', () => {
  const summary = traffic_summary([hit('2026-10-14T10:00:00Z', '1.1.1.1')], {
    now
  })
  assert.equal(summary.previous, null)
  assert.ok(summary.daily.length < 30)
  assert.ok(summary.daily.every(day => day.date >= '2026-10-14'))
})

it('traffic tile shows change, trend, and a stale archive', () => {
  const traffic = {
    people: 120,
    deeper: 9,
    outside: 4,
    previous: 100,
    daily: [1, 3, 2, 5].map((people, at) => ({
      date: `2026-10-1${at}`,
      people
    })),
    newest: '2026-10-13T12:00:00Z'
  }
  const lines = traffic_lines(traffic, 44, false, now)
  assert.equal(lines.length, 4)
  assert.equal(traffic_lines(traffic, 30, false, now)[0], '120 people  ↑20%')
  assert.equal(lines[0], '7d 120 people  ↑20%  9 deeper  4 referred')
  assert.equal(
    lines[1],
    `${'▂'.repeat(11)}${'▅'.repeat(11)}${'▄'.repeat(11)}${'█'.repeat(11)}`
  )
  assert.equal(lines[2], 'archive 72h old')
  assert.equal(lines[3], '10-10 to 10-13; people per day')
  const wide = traffic_lines(traffic, 90, false, now)
  assert.equal(
    wide[0],
    '7d 120 people  ↑20%  9 went deeper  4 from other sites'
  )
  assert.equal(wide[2], 'archive 72h old')
  const fresh = traffic_lines(
    { ...traffic, newest: '2026-10-16T11:00:00Z' },
    40,
    false,
    now
  )
  assert.doesNotMatch(fresh.join(' '), /archive/)
  assert.match(traffic_lines(undefined, 40, false)[0], /npm run traffic/)
  assert.match(
    traffic_lines(
      { status: 'failed', error: 'no traffic archive; run npm run traffic' },
      40,
      false
    )[0],
    /no traffic archive/
  )
})

it('dashboard places site traffic in the left column', () => {
  const text = frame({
    snapshot: {
      panels: {
        traffic: {
          people: 7,
          deeper: 1,
          outside: 0,
          previous: null,
          daily: [],
          newest: new Date(now).toISOString()
        }
      }
    },
    width: 110,
    height: 30,
    on: false,
    now
  })
  assert.match(text, /╭─ SITE TRAFFIC {2}homepage ─+╮│/)
  assert.match(text, /│ 7d 7 people {2}1 went deeper {2}0 from other sites +│/)
})

it('traffic tile names a refresh that stopped', () => {
  const traffic = {
    people: 12,
    deeper: 1,
    outside: 0,
    previous: null,
    daily: [],
    newest: '2026-10-13T12:00:00Z',
    refresh: {
      state: 'failed',
      error: 'gcloud not found',
      at: '2026-10-16T11:59:00Z'
    }
  }
  const wide = traffic_lines(traffic, 120, false, now)
  assert.equal(wide[0], '7d 12 people  1 went deeper  0 from other sites')
  assert.equal(wide[2], 'not refreshing')
})

it('a read archive that is old says it is still reading', () => {
  const traffic = {
    people: 12,
    deeper: 1,
    outside: 0,
    previous: null,
    daily: [],
    newest: '2026-10-13T12:00:00Z',
    refresh: { state: 'ok', added: 0, pages: 1, at: '2026-10-16T11:59:00Z' }
  }
  const wide = traffic_lines(traffic, 120, false, now)
  assert.equal(wide[0], '7d 12 people  1 went deeper  0 from other sites')
  assert.equal(wide[2], 'archive 72h old, still reading')
})

it('dashboard names a traffic read that stopped in STATUS', () => {
  const text = frame({
    snapshot: {
      panels: {
        traffic: {
          people: 7,
          deeper: 1,
          outside: 0,
          previous: null,
          daily: [],
          newest: new Date(now).toISOString(),
          refresh: {
            state: 'failed',
            error: 'ERROR: no credentials',
            at: new Date(now).toISOString()
          }
        }
      }
    },
    width: 110,
    height: 30,
    on: false,
    now
  })
  assert.match(text, /Site traffic not refreshing: ERROR: no/)
  assert.match(text, /credentials/)
})
