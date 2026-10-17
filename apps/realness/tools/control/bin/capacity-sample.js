import { readFile as read_file, statfs } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const cpu_field_end = 9
const iowait_index = 4
const sample_window_ms = 100
const bytes_per_kib = 1024

const [, , disk] = process.argv
if (!disk) throw new Error('actor disk directory required')
const cpu = async () => {
  const [line] = (await read_file('/proc/stat', 'utf8')).split('\n')
  const ticks = line.trim().split(/\s+/).slice(1, cpu_field_end).map(Number)
  return {
    total: ticks.reduce((sum, n) => sum + n, 0),
    idle: ticks[3] + ticks[iowait_index]
  }
}
const before = await cpu()
await delay(sample_window_ms)
const after = await cpu()
const memory = await read_file('/proc/meminfo', 'utf8')
const available = memory.match(/^MemAvailable:\s+(\d+) kB$/m)
if (!available || after.total <= before.total)
  throw new Error('halo resources unavailable')
const fs = await statfs(disk)
process.stdout.write(
  `${JSON.stringify({
    memory_bytes: Number(available[1]) * bytes_per_kib,
    disk_bytes: fs.bavail * fs.bsize,
    cpu_fraction: 1 - (after.idle - before.idle) / (after.total - before.total)
  })}\n`
)
