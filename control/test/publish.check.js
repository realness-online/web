#!/usr/bin/env node
// p7: a session starts a site from the example, builds, publishes, changes it,
// and republishes; a browser shows the change after reload. Twice, each from a
// new session. No model calls: the steps Pi's /site prompt runs, through exec.
//
// Needs the dev host (`webspace dev host up`) and agent-browser.
//
//   npm run check:publish            two runs
//   RUNS=1 npm run check:publish

import { execFileSync } from "node:child_process"

const API = process.env.API ?? "http://127.0.0.1:18080"
const RUNS = Number(process.env.RUNS ?? 2)
const EXAMPLE = "gh:scott-fryxell/brayness-examples/static"
const SITE = "/root/brayness/work/site"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function exec(session, command, timeout = 120) {
  const response = await fetch(`${API}/v1/sessions/${session}/exec`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ argv: ["/bin/bash", "-lc", command], timeout }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(`exec: ${result.error}`)
  const out = Buffer.from(result.stdout_b64, "base64").toString()
  const err = Buffer.from(result.stderr_b64, "base64").toString()
  if (result.exit_code !== 0) throw new Error(`\`${command}\` exited ${result.exit_code}: ${(err || out).slice(-400)}`)
  return out
}

async function until(what, ms, test) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (await test()) return
    await sleep(250)
  }
  throw new Error(`${what}: not within ${ms}ms`)
}

async function run(n) {
  const ab = (...args) =>
    execFileSync("agent-browser", ["--session", `brayness-p7-check-${process.pid}-${n}`, ...args], {
      encoding: "utf8",
    }).trim()
  // The example's header partial ignores site.json; the name reaches <title>.
  const page_title = () => JSON.parse(ab("eval", "document.title"))
  let session = null
  const step = async (label, fn) => {
    const start = Date.now()
    const value = await fn()
    console.log(`  ok ${label} (${Date.now() - start}ms)`)
    return value
  }

  try {
    await step("create a session", async () => {
      const response = await fetch(`${API}/v1/sessions`, { method: "POST" })
      if (!response.ok) throw new Error(`create: ${response.status} ${await response.text()}`)
      session = (await response.json()).id
    })

    await step("start the site from the example", () =>
      exec(session, `mkdir -p /root/brayness/work && cd /root/brayness/work && npx -y giget ${EXAMPLE} site && cd site && npm install --no-fund --no-audit && sync`, 900),
    )

    const link = await step("build and publish", async () => {
      const out = await exec(session, `cd ${SITE} && npm run build && brayness publish dist`, 300)
      const url = out.trim().split("\n").pop()
      if (!url.startsWith("http")) throw new Error(`no link in: ${out.slice(-300)}`)
      return url
    })

    await step("the browser shows the site", async () => {
      ab("open", link)
      await until("the example's name", 10000, () => page_title().includes("Your Name"))
    })

    const name = `P7 ${Math.random().toString(36).slice(2, 7)}`
    await step("change, rebuild, republish", () =>
      exec(
        session,
        `cd ${SITE} && node -e 'const f="site.json",s=JSON.parse(require("fs").readFileSync(f));s.name=process.argv[1];require("fs").writeFileSync(f,JSON.stringify(s,null,2))' ${JSON.stringify(name)} && npm run build && brayness publish dist`,
        300,
      ),
    )

    await step("reload shows the change", async () => {
      ab("reload")
      await until(`"${name}" after reload`, 10000, () => page_title().includes(name))
    })
    console.log(`  ${link}`)
  } finally {
    try {
      ab("close")
    } catch {}
    if (session) await fetch(`${API}/v1/sessions/${session}`, { method: "DELETE" }).catch(() => {})
  }
}

const health = await fetch(`${API}/v1/health`).then((r) => r.json())
if (!health.ok || !health.seed?.built || !health.seed?.matches) {
  console.error(`dev host not ready: ${JSON.stringify(health.seed)}`)
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
console.log(failed ? "p7: FAIL" : `p7: ${RUNS} clean runs passed`)
process.exit(failed ? 1 : 0)
