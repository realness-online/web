#!/usr/bin/env node
// z1: prove the hosted terminal in a real browser, twice from a clean start.
//
// Needs the dev host (`webspace dev host up`) and agent-browser. Each run opens
// a new session and a new browser, drives the page with press and paste events
// (the page reads keydown, not typed text), and removes both afterwards.
// No model calls: `!` shell lines and slash commands only.
//
//   npm run check:browser            two runs
//   RUNS=1 npm run check:browser

import { execFileSync } from "node:child_process"

const API = process.env.API ?? "http://127.0.0.1:18080"
const PAGE = process.env.PAGE ?? "http://127.0.0.1:18090/"
const RUNS = Number(process.env.RUNS ?? 2)
// The seed holds a running Pi (h4): it should draw almost as soon as the page.
const PI_BUDGET_MS = Number(process.env.PI_BUDGET_MS ?? 2000)
const CREATE_BUDGET_MS = Number(process.env.CREATE_BUDGET_MS ?? 20000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// AGENT_BROWSER_HEADED=1 shows the window, to watch a run.
const browser = (name) => (...args) =>
  execFileSync("agent-browser", ["--session", name, ...args], { encoding: "utf8" }).trim()

async function until(what, ms, test) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const value = await test()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`${what}: not within ${ms}ms`)
}

async function run(n) {
  const name = `brayness-z1-check-${process.pid}-${n}`
  const ab = browser(name)
  // eval prints its result as JSON; functions keep names out of the shared global scope.
  const js = (body) => JSON.parse(JSON.parse(ab("eval", `JSON.stringify((() => { ${body} })())`)))
  const screen = () => js("return window.brayness?.screen_text?.() ?? ''")
  const lines = () => screen().split("\n")
  const paste = (text) =>
    js(`const dt = new DataTransfer(); dt.setData("text/plain", ${JSON.stringify(text)});
        window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true })); return 1`)
  const enter = () => ab("press", "Enter")
  let session = null
  const times = {}
  const step = (label, fn) => {
    const start = Date.now()
    return Promise.resolve(fn()).then((value) => {
      times[label] = Date.now() - start
      console.log(`  ok ${label} (${times[label]}ms)`)
      return value
    })
  }

  try {
    const opened = Date.now()
    // Create through the API, not GET /: a retried page load would mint another
    // session per attempt, and the redirect waits out the whole create.
    await step("z1a create a session and open it", async () => {
      const response = await fetch(`${API}/v1/sessions`, { method: "POST" })
      if (!response.ok) throw new Error(`create: ${response.status} ${await response.text()}`)
      session = (await response.json()).id
      if (Date.now() - opened > CREATE_BUDGET_MS) throw new Error("session create over budget")
      const url = new URL(PAGE)
      url.searchParams.set("session", session)
      url.searchParams.set("exec", "brayness")
      ab("open", url.href)
    })

    await step("z1b pi drawn and a key echoes", async () => {
      await until("pi prompt", PI_BUDGET_MS, () => screen().includes("inkling"))
      ab("click", "canvas")
      ab("press", "q")
      await until("key echo", PI_BUDGET_MS, () => lines().some((l) => l.trim() === "q"))
      ab("press", "Backspace")
    })

    const tag = Math.random().toString(36).slice(2, 7)
    const marker = `z1-42-${tag}`
    await step("z1c paste, press, and a shell line", async () => {
      paste("!echo z1-$((6*7))-")
      for (const key of tag) ab("press", key)
      enter()
      await until("marker output", 15000, () => lines().some((l) => l.trim() === marker))
    })

    await step("z1h a slash command renders", async () => {
      paste("/session")
      enter()
      await until("/session output", 5000, () => screen().includes("Session Info"))
    })

    await step("z1e resize reflows pi", async () => {
      const before = js("const f = window.brayness.frame(); return { cols: f.cols, rows: f.rows }")
      // Short enough that seq output overflows into scrollback for z1d.
      ab("set", "viewport", "1000", "480")
      const after = await until("new size", 3000, () => {
        const f = js("const f = window.brayness.frame(); return { cols: f.cols, rows: f.rows }")
        return f.cols !== before.cols ? f : null
      })
      // Pi draws its rules the full width; one that matches proves the pty got the size.
      await until("pi redraw at the new width", 5000, () =>
        lines().some((l) => l.length === after.cols && /^─+$/.test(l)),
      )
    })

    await step("z1d scrollback scrolls both ways", async () => {
      paste("!seq 1 120")
      enter()
      await until("seq output", 15000, () => lines().some((l) => l.trim() === "120"))
      const wheel = (dy) =>
        js(`document.querySelector("canvas").dispatchEvent(new WheelEvent("wheel", { deltaY: ${dy}, bubbles: true, cancelable: true }));
            return window.brayness.scrollbar()`)
      const bottom = js("return window.brayness.scrollbar()")
      if (bottom.total <= bottom.len) throw new Error(`no scrollback: ${JSON.stringify(bottom)}`)
      const up = wheel(-100)
      if (up.offset >= bottom.offset) throw new Error(`wheel up did not move: ${JSON.stringify(up)}`)
      const down = wheel(100)
      if (down.offset <= up.offset) throw new Error(`wheel down did not move: ${JSON.stringify(down)}`)
      js("window.brayness.scroll(1e6); return 1")
    })

    await step("z1f select and copy", async () => {
      // Scrolling and resizing moved the first marker off screen; print it again.
      paste(`!echo ${marker}`)
      enter()
      await until("marker on screen", 15000, () => lines().some((l) => l.trim() === marker))
      const at = js(`const rows = window.brayness.screen_text().split("\\n");
        const y = rows.findIndex((l) => l.trim() === ${JSON.stringify(marker)});
        const x = rows[y].indexOf(${JSON.stringify(marker)});
        const f = window.brayness.frame(), r = document.querySelector("canvas").getBoundingClientRect();
        const w = r.width / f.cols, h = r.height / f.rows;
        return { x0: r.left + (x + 0.5) * w, x1: r.left + (x + ${marker.length} - 0.5) * w, y: r.top + (y + 0.5) * h }`)
      ab("mouse", "move", String(Math.round(at.x0)), String(Math.round(at.y)))
      ab("mouse", "down")
      ab("mouse", "move", String(Math.round(at.x1)), String(Math.round(at.y)))
      ab("mouse", "up")
      const selected = js("return window.brayness.selection_text()")
      if (selected.trim() !== marker) throw new Error(`selected ${JSON.stringify(selected)}`)
      ab("press", "Meta+c")
      await until("copied note", 3000, () => js("return document.body.innerText").includes(`copied ${selected.length} chars`))
    })

    await step("z1g reload reattaches", async () => {
      ab("reload")
      const again = new URL(ab("get", "url")).searchParams.get("session")
      if (again !== session) throw new Error(`reload moved to ${again}`)
      await until("marker after reload", 10000, () => screen().includes(marker))
    })

    return times
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
console.log(failed ? "z1: FAIL" : `z1: ${RUNS} clean runs passed`)
process.exit(failed ? 1 : 0)
