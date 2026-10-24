#!/usr/bin/env node
import { readdirSync as readdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { hash, prune } from '../lib/web-md-cache.js'
import { assess, read_day, reuse, summarize } from '../lib/web-md-log.js'

const HERE = dirname(file_url_to_path(import.meta.url))
const cache_root = process.env.WEB_MD_CACHE ?? join(HERE, '..', '..', 'artifacts', 'web-md', 'cache')
const root = process.env.WEB_MD_LOG ?? join(dirname(cache_root), 'log')
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback
}

if (args.includes('--prune')) {
  const idle_days = option('--idle-days', 30)
  console.log(`web-md prune: dropped ${prune(cache_root, { idle_days })} pages unread for ${idle_days} days`)
} else if (args.includes('--times')) {
  const days = option('--days', 30)
  const lines = []
  for (let i = days - 1; i >= 0; i--) lines.push(...read_day(root, new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)))
  const hosts = {}
  try {
    for (const f of readdir_sync(join(cache_root, 'sites'))) hosts[hash(f.replace(/\.json$/, ''))] = f.replace(/\.json$/, '')
  } catch {}
  const urls = {}
  try {
    for (const f of readdir_sync(join(cache_root, 'pages'))) {
      try {
        urls[f.replace(/\.json$/, '')] = JSON.parse(read_file_sync(join(cache_root, 'pages', f), 'utf8')).url
      } catch {}
    }
  } catch {}
  const used = reuse(lines)
  const by_site = args.includes('--by-site')
  const groups = assess(lines, by_site ? line => hosts[line.site] ?? line.site.slice(0, 12) : undefined)
  if (args.includes('--json')) {
    console.log(JSON.stringify({ days, reads: lines.length, groups, reuse: used }))
  } else {
    console.log(`web-md cache times, last ${days} days: ${lines.length} reads, by ${by_site ? 'site' : 'rule'}`)
    const rows = Object.entries(groups).sort((a, b) => b[1].reads - a[1].reads)
    for (const [name, g] of rows) {
      const hit = `${Math.round((100 * g.hits) / g.reads)}%`
      const re = g.rereads ? `${g.changed}/${g.rereads} changed` : 'no rereads'
      const ages = [g.median_unchanged_h, g.median_changed_h].map(h => (h == null ? '-' : `${h}h`)).join('/')
      const s = g.served
      const lied = g.validated ? `, validators lied ${g.lied}/${g.validated}` : ''
      console.log(
        `  ${name.slice(0, 28).padEnd(28)} ${String(g.reads).padStart(4)} reads, hit ${hit.padStart(4)}, ${re} (median age unchanged/changed ${ages}), served <7d ${s.under_7d} 7-30d ${s['7_30d']} 30-90d ${s['30_90d']} >90d ${s.over_90d}${lied}`
      )
    }
    const b = used.bands
    const share = n => (used.pages ? `${Math.round((100 * n) / used.pages)}%` : '-')
    console.log(`reuse: ${used.pages} pages; reused never ${b.never} (${share(b.never)}), once ${b['1']}, 2-5 times ${b['2_5']}, over 5 ${b.over_5}`)
    for (const p of used.top) console.log(`  ${String(p.reused).padStart(4)} of ${String(p.reads).padStart(4)} reads  ${urls[p.url] ?? p.url.slice(0, 12)}`)
    console.log('  Mostly unchanged rereads: the time is too short. Often changed: too long.')
    console.log('  Few reads past 30d: the idle window can shrink. Validators that lie: stop trusting that site\'s ETag.')
  }
} else {
  const day = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)
  const report = { day, ...summarize(read_day(root, day)) }
  if (args.includes('--json')) {
    console.log(JSON.stringify(report))
  } else {
    const pct = n => (report.reads ? `${Math.round((100 * n) / report.reads)}%` : '-')
    console.log(`web-md ${day}: ${report.reads} reads of ${report.urls} pages`)
    console.log(`  repeats today ${report.repeats_today} (${pct(report.repeats_today)}), read before ${report.seen_before} (${pct(report.seen_before)})`)
    console.log(`  rendered ${report.rendered} (${pct(report.rendered)})`)
    for (const [outcome, n] of Object.entries(report.by_outcome).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${outcome.padEnd(13)} ${String(n).padStart(4)}  ${pct(n)}`)
    }
    for (const [method, m] of Object.entries(report.by_method)) {
      const tries = m.ok + m.failed
      console.log(`  ${method.padEnd(13)} ${m.ok}/${tries} ok, ${Math.round(m.ms / tries)} ms each`)
    }
  }
}
