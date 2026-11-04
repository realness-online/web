#!/usr/bin/env node
import { writeFileSync as write_file_sync } from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import { ChromeVm, mib, rss, seconds } from './chrome-vm.js'

const DEFAULT_MIB = 1024
/** A real screenshot is larger than an empty PNG. */
const MIN_PNG_BYTES = 1000
const URL = process.env.URL ?? 'https://example.com/'
const run = out_path(
  `chrome-snapshot-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`
)
const vm = new ChromeVm({
  work: join(run, 'vm'),
  mib: Number(process.env.MIB ?? DEFAULT_MIB),
  vcpus: Number(process.env.VCPUS ?? 2)
})
const result = {
  url: URL,
  mib: vm.mib,
  vcpus: vm.vcpus,
  tap: vm.tap,
  address: vm.address
}

try {
  let clock = performance.now()
  result.chrome = (await vm.boot()).Browser
  result.cold_devtools_s = seconds(clock)
  result.cold_render_s = (await vm.render(URL, { screenshot: false })).load
  result.cold_rss_mib = mib(rss(vm.pid))

  clock = performance.now()
  result.snapshot_mem_mib = (await vm.snapshot()).mem_mib
  result.snapshot_s = seconds(clock)

  clock = performance.now()
  await vm.restore()
  result.restore_devtools_s = seconds(clock)
  result.restore_rss_mib = mib(rss(vm.pid))
  const page = await vm.render(URL)
  result.restore_render_s = page.load
  result.restore_total_s = seconds(clock)
  result.restore_rss_after_render_mib = mib(rss(vm.pid))
  result.title = page.title
  result.png_bytes = page.png?.length ?? 0
  if (page.png) write_file_sync(join(run, 'page.png'), page.png)
} catch (error) {
  result.error = error.message
} finally {
  await vm.stop()
}

write_file_sync(
  join(run, 'result.json'),
  `${JSON.stringify(result, null, 2)}\n`
)
console.info(JSON.stringify(result, null, 2))
console.info(`run: ${run}`)
process.exit(result.png_bytes > MIN_PNG_BYTES ? 0 : 1)
