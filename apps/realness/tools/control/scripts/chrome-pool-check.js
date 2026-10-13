#!/usr/bin/env node
import { mkdirSync as mkdir_sync, writeFileSync as write_file_sync } from "node:fs"
import { join } from "node:path"
import { out_path } from "#root/lib/output.js"
import { ChromePool } from "#root/src/host/chrome-pool.js"
import { ChromeVm, mib, rss } from "./chrome-vm.js"

const URL = process.env.URL ?? "https://example.com/"
const COPIES = Number(process.env.COPIES ?? 3)
const run = out_path(`chrome-pool-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`)
const pool = new ChromePool({ root: process.env.POOL_ROOT ?? "/opt/fc/chrome-pool", mib: Number(process.env.MIB ?? 1024) })
const result = { url: URL, copies: COPIES, failures: [] }
const fail = (what) => result.failures.push(what)

const render = (address, url, options) =>
  ChromeVm.prototype.render.call({ devtools: () => fetch(`http://${address}:9222/json/version`).then((r) => r.json()) }, url, options)

try {
  if (process.env.SEED !== "keep" || !pool.seeded) result.seed = await pool.seed()

  let clock = performance.now()
  const leased = await Promise.all(Array.from({ length: COPIES }, () => pool.restore()))
  result.restore_all_s = (performance.now() - clock) / 1000
  result.restored = leased.map(({ n, address, disk_s, restore_s, pid }) => ({ n, address, disk_s, restore_s, rss_mib: mib(rss(pid)) }))
  if (new Set(leased.map((c) => c.address)).size !== COPIES) fail("copies share an address")

  clock = performance.now()
  const pages = await Promise.all(leased.map((c) => render(c.address, URL, { screenshot: false })))
  result.render_all_s = (performance.now() - clock) / 1000
  result.pages = pages.map(({ ok, reason, load, title, chars }, i) => ({ n: leased[i].n, ok, reason, load, title, chars }))
  for (const p of result.pages) if (!p.ok) fail(`copy ${p.n} did not render: ${p.reason}`)

  if (COPIES >= 2) {
    const [a, b] = leased
    const reached = async (url) => /"Browser"/.test((await render(a.address, url, { screenshot: false, limit: 8000, keep_text: true })).text ?? "")
    result.copy_to_copy = await reached(`http://${b.address}:9222/json/version`)
    result.copy_to_self = await reached(`http://127.0.0.1:9223/json/version`)
    if (result.copy_to_copy) fail("copy reached another copy")
  }
  result.rss_after_mib = leased.map((c) => mib(rss(c.pid)))
} catch (error) {
  fail(error.message)
} finally {
  await pool.destroy_all()
}

result.ok = result.failures.length === 0
mkdir_sync(run, { recursive: true })
write_file_sync(join(run, "result.json"), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
console.log(`run: ${run}`)
process.exit(result.ok ? 0 : 1)
