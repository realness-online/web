#!/usr/bin/env node

import { existsSync as exists_sync, readFileSync as read_file_sync, readdirSync as readdir_sync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { fileURLToPath as file_url_to_path } from "node:url"
import { plans_path, plans_ignore } from "../lib/harness-settings.js"
import { legend } from "../lib/palette.js"

const ROOT = join(dirname(file_url_to_path(import.meta.url)), "../..")
const plans_at = process.argv.indexOf("--plans")
const PLANS = plans_at > 0 ? process.argv[plans_at + 1] : join(ROOT, plans_path(ROOT))
const IGNORED = new Set(plans_ignore(ROOT))

const LEGEND = new Set(legend(ROOT))

const find = (text, re) => {
  const at = text.search(re)
  return at < 0 ? null : text.slice(0, at).split("\n").length
}

/** Every mermaid fence, in order, as {line, body}. */
const fences = (text) => {
  const out = []
  const lines = text.split("\n")
  let open = null
  lines.forEach((line, i) => {
    if (line.startsWith("```mermaid")) open = { line: i + 1, body: [] }
    else if (open && line.startsWith("```")) { out.push({ ...open, body: open.body.join("\n") }); open = null }
    else if (open) open.body.push(line)
  })
  return out
}

/** Node ids: the id before a [" ... "] or {{ ... }} shape, anywhere on a line. */
const node_ids = (body) => {
  const ids = []
  for (const line of body.split("\n")) {
    if (line.includes("classDef") || line.trim().startsWith("class ")) continue
    for (const m of line.matchAll(/(?:^|[\s>])([a-zA-Z][a-zA-Z0-9_-]*)\s*(?:\[|{{)/g)) ids.push(m[1])
  }
  return ids
}

const NODE_TABLE = /^\|\s*(Node|ID|id)\s*\|(?!.*\b(Severity|Finding|Phase)\b)/
const table_ids = (text) => {
  const ids = []
  const lines = text.split("\n")
  const start = lines.findIndex((l) => NODE_TABLE.test(l))
  if (start < 0) return ids
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trimStart().startsWith("|")) break
    const cell = line.split("|")[1]?.trim() ?? ""
    const id = cell.match(/^~~([a-zA-Z][a-zA-Z0-9_-]*)~~|^([a-zA-Z][a-zA-Z0-9_-]*)/)
    if (id) ids.push(id[1] ?? id[2])
  }
  return ids
}


const check = (name, text) => {
  const problems = []
  const bad = (rule, detail) => problems.push({ rule, detail })
  const lines = text.split("\n")

  const first = lines[0] === "---" ? lines.slice(1).findIndex((l) => l.startsWith("# ")) + 2 : lines[0].startsWith("# ") ? 1 : 0
  if (!first) bad("title first", `line 1 is "${lines[0].slice(0, 40)}"`)

  const graphs = fences(text)
  if (!graphs.length) {
    bad("dag present", "no mermaid fence")
  } else {
    const dag = graphs[0]
    const first_h2 = find(text, /^## /m)
    if (first_h2 !== null && dag.line > first_h2) bad("dag first", `first DAG at line ${dag.line}, before it a "## " heading at ${first_h2}`)


    const all = [...new Set(node_ids(graphs.map((g) => g.body).join("\n")))]
    const table = table_ids(text)
    const missing = table.filter((id) => !all.includes(id))
    if (table.length && missing.length) bad("node coverage", `in table, not in any DAG: ${missing.join(", ")}`)
  }

  const nodes_at = find(text, /^## Nodes\b/m)
  const notes_at = find(text, /^## Notes\b/m)
  if (nodes_at && notes_at && nodes_at > notes_at) bad("nodes then notes", "## Nodes after ## Notes")
  const others = lines
    .map((l, i) => (/^## /.test(l) ? { line: i + 1, text: l } : null))
    .filter((h) => h && !/^## (Nodes|Syncs|Notes)\b/.test(h.text))
  if (others.length && nodes_at) bad("no other ## headings", others.map((h) => `line ${h.line}: ${h.text}`).join("; "))

  for (const g of graphs) {
    for (const line of g.body.split("\n")) {
      const t = line.trim()
      if (t.startsWith("classDef") && !LEGEND.has(t)) bad("legend", `line ${g.line}, not a fixed classDef: ${t.slice(0, 50)}`)
    }
    const stray = g.body.replace(/[✅🔄⛔🚦✓◐✕◆]/g, "")
    if (/[^\x00-\x7F]/.test(stray)) bad("ascii", `non-ASCII character in the fence at line ${g.line}`)
  }

  return problems
}

if (!exists_sync(PLANS)) {
  console.log(`no ${PLANS}/ - nothing to check`)
  process.exit(0)
}

const files = readdir_sync(PLANS).filter((f) => f.endsWith(".md") && !IGNORED.has(f)).sort()
let failed = 0
for (const file of files) {
  const problems = check(file, read_file_sync(join(PLANS, file), "utf8"))
  const errors = problems.filter((p) => !p.rule.includes("warn"))
  if (!problems.length) continue
  if (errors.length) failed++
  console.log(`${errors.length ? "FAIL" : "WARN"} ${basename(file)}`)
  for (const p of problems) console.log(`      ${p.rule}: ${p.detail}`)
}

console.log(`\n${files.length} plans, ${failed} failed`)
process.exit(process.argv.includes("--warn") ? 0 : failed ? 1 : 0)
