#!/usr/bin/env node
import {
  appendFileSync as append_file_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import { ChromeVm, cpu, mib, rss } from './chrome-vm.js'

const urls = read_file_sync(process.argv[2], 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
const run = out_path(
  `chrome-render-pages-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`
)
const vm = new ChromeVm({
  work: join(run, 'vm'),
  mib: Number(process.env.MIB ?? 512),
  vcpus: Number(process.env.VCPUS ?? 2),
  huge_pages: process.env.HUGE_PAGES
})
const rows = []
let rss_mib = 0

try {
  await vm.boot()
  await vm.render('https://example.com/', { screenshot: false })
  if (!process.env.COLD) {
    await vm.snapshot()
    await vm.restore()
  }
  for (const url of urls) {
    const before = cpu(vm.pid)
    const page = await vm.render(url, { screenshot: false })
    const spent = cpu(vm.pid) - before
    const after = cpu(vm.pid)
    await new Promise(done => setTimeout(done, 5000))
    const idle = cpu(vm.pid) - after
    rows.push({
      url,
      ok: page.ok,
      reason: page.reason ?? '',
      load_s: page.load,
      cpu_s: Number(spent.toFixed(2)),
      idle_cpu_s: Number(idle.toFixed(2)),
      chars: page.chars ?? 0
    })
    rss_mib = mib(rss(vm.pid))
    const line = `${page.ok ? 'ok  ' : 'FAIL'} ${page.load}s ${rows.at(-1).cpu_s}cpu ${rows.at(-1).idle_cpu_s}idle ${url}${page.reason ? ` (${page.reason})` : ''}`
    append_file_sync(join(run, 'progress.log'), `${line}\n`)
    console.log(line)
  }
} finally {
  await vm.stop().catch(() => {})
}

const ok = rows.filter(row => row.ok)
const sum = (list, key) => list.reduce((total, row) => total + row[key], 0)
const summary = {
  pages: rows.length,
  ok: ok.length,
  success: Number((ok.length / rows.length).toFixed(2)),
  cpu_s_per_page: Number((sum(rows, 'cpu_s') / rows.length).toFixed(2)),
  load_s_median: rows.map(row => row.load_s).sort((a, b) => a - b)[
    Math.floor(rows.length / 2)
  ],
  failures: Object.fromEntries(
    Object.entries(
      Object.groupBy(
        rows.filter(row => !row.ok),
        row => row.reason
      )
    ).map(([reason, list]) => [reason, list?.length ?? 0])
  ),
  rss_after_mib: rss_mib,
  mib: vm.mib,
  huge_pages: vm.huge_pages ?? 'none',
  vcpus: vm.vcpus
}
write_file_sync(
  join(run, 'pages.tsv'),
  `${[
    'url\tok\treason\tload_s\tcpu_s\tidle_cpu_s\tchars',
    ...rows.map(row => Object.values(row).join('\t'))
  ].join('\n')}\n`
)
write_file_sync(
  join(run, 'summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`
)
console.log(JSON.stringify(summary, null, 2))
console.log(`run: ${run}`)
