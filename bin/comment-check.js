#!/usr/bin/env node
/**
 * Fail when source carries a comment that is not JSDoc or a tool directive.
 *
 * @param {string[]} argv - paths to scan, or none for the default roots
 * @returns {void}
 */

import { existsSync as exists_sync, readFileSync as read_file_sync, readdirSync as readdir_sync, statSync as stat_sync } from "node:fs"
import { parse, join } from "node:path"
import { comment_ranges, has_parser } from "./lib/comments.js"

const SKIP = new Set([
  "node_modules", ".git", "artifacts", "vault", "dist", "build", "coverage",
  ".obsidian", "sessions", ".agents", ".claude", ".cursor", ".cache", "vendor",
  ".venv", "site-packages", "__pycache__", ".pytest_cache", ".mypy_cache", "tmp", "public",
])

const EXT = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".rs", ".css", ".styl", ".scss", ".html", ".sh", ".bash", ".zsh", ".py", ".lua"])

const is_minified = (text) => {
  let start = 0
  let line = text.indexOf("\n", start)
  while (line !== -1) {
    if (line - start > 1000) return true
    start = line + 1
    line = text.indexOf("\n", start)
  }
  return text.length - start > 1000
}

const hits = []
const scan = (file) => {
  if (/\.test\.(js|ts|mjs|cjs)$/.test(file) || file.endsWith(".d.ts")) return
  const text = read_file_sync(file, "utf8")
  if (text.includes("\0") || is_minified(text)) return
  for (const range of comment_ranges(text, parse(file).ext)) {
    if (range.keep) continue
    const raw = text.slice(range.start, range.end)
    const line = text.slice(0, range.start).split("\n").length
    hits.push(`${file}:${line}  comment  ${raw.split("\n")[0].trim().slice(0, 90)}`)
  }
}

const walk = (target) => {
  if (!exists_sync(target)) return
  const info = stat_sync(target)
  if (info.isDirectory()) {
    if (SKIP.has(parse(target).base)) return
    for (const entry of readdir_sync(target, { withFileTypes: true })) {
      if (entry.isDirectory()) { if (!SKIP.has(entry.name)) walk(join(target, entry.name)) }
      else if (entry.isFile() && EXT.has(parse(entry.name).ext)) scan(join(target, entry.name))
    }
  } else if (info.isFile() && EXT.has(parse(target).ext)) scan(target)
}

const DEFAULTS = ["apps/realness", "apps/blog", "work/seeq-app", "work/decision-ontology", "work/realness-flex", "work/seeq-models", "work/site", "work/haight-ship", "work/nvim", "work/kata-machine", "bin", "skills", ".pi/skills", ".pi/extensions"]
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS
if (!has_parser()) console.error("comment-check: @babel/parser and @vue/compiler-sfc not found; JS and Vue are not checked")
targets.forEach(walk)
hits.forEach(hit => console.log(hit))
console.log(`comments: ${hits.length} hit(s)`)
process.exit(hits.length ? 1 : 0)