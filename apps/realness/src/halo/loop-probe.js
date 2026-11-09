const fs = process.getBuiltinModule('node:fs')
const dir = process.argv[1] ?? '/realness/work/loop'
const EVENTS_BYTES = 65_536
const TAIL_BYTES = 16_384
const TAIL_LINES = 20

/**
 * @param {string} path
 * @param {number} [tail]
 */
const read = (path, tail = 0) => {
  if (!fs.existsSync(path)) return ''
  const bytes = fs.readFileSync(path)
  return bytes.subarray(tail ? Math.max(0, bytes.length - tail) : 0).toString()
}

/** @param {string} text */
const parse = text => {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return {}
  }
}

const status = parse(read(`${dir}/status.json`))
const runs = read(`${dir}/.auto/log.jsonl`)
  .split('\n')
  .filter(line => line.includes('"run":')).length
const quota = read(`${dir}/events.jsonl`, EVENTS_BYTES).includes(
  'quota exceeded'
)
const tail = read(`${dir}/.auto/log.jsonl`, TAIL_BYTES)
  .split('\n')
  .slice(-TAIL_LINES)
process.stdout.write(
  `${JSON.stringify({ state: status.state, tokens: status.tokens ?? 0, runs, quota, tail })}\n`
)
