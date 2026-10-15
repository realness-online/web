import { setTimeout as delay } from 'node:timers/promises'

const max_amount = 1024
const max_duration_ms = 60000
const bytes_per_mib = 1048576
const page_bytes = 4096
const touch_interval_ms = 10
const iterations_per_unit = 1000
const checksum_multiplier = 31

const [kind, amount_text, duration_text] = process.argv.slice(2)
const amount = Number(amount_text)
const duration_ms = Number(duration_text)
if (
  !['memory', 'cpu'].includes(kind) ||
  !Number.isInteger(amount) ||
  amount < 1 ||
  amount > max_amount ||
  !Number.isInteger(duration_ms) ||
  duration_ms < 1 ||
  duration_ms > max_duration_ms
)
  throw new Error(
    'usage: node capacity-workload.js memory|cpu <MiB|iterations> <duration-ms>; max 1024 and 60000'
  )
if (kind === 'memory') {
  const memory = Buffer.alloc(amount * bytes_per_mib, 1)
  const until = Date.now() + duration_ms
  while (Date.now() < until) {
    for (let i = 0; i < memory.length; i += page_bytes) memory[i] ^= 1
    // eslint-disable-next-line no-await-in-loop -- Repeated touches must stay within one bounded memory hold.
    await delay(touch_interval_ms)
  }
  process.stdout.write(
    `${JSON.stringify({ kind, bytes: memory.length, duration_ms })}\n`
  )
} else {
  const until = Date.now() + duration_ms
  let checksum = 0
  while (Date.now() < until)
    for (let i = 0; i < amount * iterations_per_unit; i += 1)
      checksum = Math.imul(checksum + i, checksum_multiplier)
  process.stdout.write(`${JSON.stringify({ kind, checksum, duration_ms })}\n`)
}
