#!/usr/bin/env node

import { execFileSync as exec_file_sync } from 'node:child_process'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const RUNS = Number(process.env.RUNS ?? 2)
const SITE = '/realness/work/site'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const exec = async (actor, command, timeout = 120) => {
  const response = await fetch(`${API}/v1/actors/${actor}/exec`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ argv: ['/bin/bash', '-lc', command], timeout })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`exec: ${result.error}`)
  const out = Buffer.from(result.stdout_b64, 'base64').toString()
  const err = Buffer.from(result.stderr_b64, 'base64').toString()
  if (result.exit_code !== 0)
    throw new Error(
      `\`${command}\` exited ${result.exit_code}: ${(err || out).slice(-400)}`
    )
  return out
}

const until = async (what, ms, test) => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (await test()) return
    await sleep(250)
  }
  throw new Error(`${what}: not within ${ms}ms`)
}

const run = async n => {
  const ab = (...args) =>
    exec_file_sync(
      'agent-browser',
      ['--session', `realness-p7-check-${process.pid}-${n}`, ...args],
      {
        encoding: 'utf8'
      }
    ).trim()
  const page_title = () => JSON.parse(ab('eval', 'document.title'))
  let actor = null
  const step = async (label, fn) => {
    const start = Date.now()
    const value = await fn()
    console.log(`  ok ${label} (${Date.now() - start}ms)`)
    return value
  }

  try {
    await step('create an actor', async () => {
      const response = await fetch(`${API}/v1/actors`, { method: 'POST' })
      if (!response.ok)
        throw new Error(`create: ${response.status} ${await response.text()}`)
      actor = (await response.json()).id
    })

    await step('start the site from the example', () =>
      exec(
        actor,
        `mkdir -p /realness/work && cd /realness/work && mkdir site && tar -C /realness/examples/static -cf - . | tar -C site -xf - && cd site && npm install --no-fund --no-audit && sync`,
        900
      )
    )

    const link = await step('build and publish', async () => {
      const out = await exec(
        actor,
        `cd ${SITE} && npm run build && realness publish dist`,
        300
      )
      const url = out.trim().split('\n').pop()
      if (!url.startsWith('http'))
        throw new Error(`no link in: ${out.slice(-300)}`)
      return url
    })

    await step('the browser shows the site', async () => {
      ab('open', link)
      await until("the example's name", 10000, () =>
        page_title().includes('Your Name')
      )
    })

    const name = `P7 ${Math.random().toString(36).slice(2, 7)}`
    await step('change, rebuild, republish', () =>
      exec(
        actor,
        `cd ${SITE} && node -e 'const f="site.json",s=JSON.parse(require("fs").readFileSync(f));s.name=process.argv[1];require("fs").writeFileSync(f,JSON.stringify(s,null,2))' ${JSON.stringify(name)} && npm run build && realness publish dist`,
        300
      )
    )

    await step('reload shows the change', async () => {
      ab('reload')
      await until(`"${name}" after reload`, 10000, () =>
        page_title().includes(name)
      )
    })
    console.log(`  ${link}`)
  } finally {
    try {
      ab('close')
    } catch {}
    if (actor)
      await fetch(`${API}/v1/actors/${actor}`, { method: 'DELETE' }).catch(
        () => {}
      )
  }
}

const health = await fetch(`${API}/v1/health`).then(r => r.json())
if (!health.ok || !health.seed?.built || !health.seed?.matches) {
  console.error(`local halo not ready: ${JSON.stringify(health.seed)}`)
  process.exit(1)
}

let failed = false
for (let n = 1; n <= RUNS; n++) {
  console.log(`run ${n}`)
  try {
    await run(n)
  } catch (error) {
    failed = true
    console.error(`  FAIL ${error.message}`)
  }
}
console.log(failed ? 'p7: FAIL' : `p7: ${RUNS} clean runs passed`)
process.exit(failed ? 1 : 0)
