#!/usr/bin/env node
import { existsSync as exists_sync, readFileSync as read_file_sync, readdirSync as readdir_sync, writeFileSync as write_file_sync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath as file_url_to_path } from "node:url"

const ROOT = join(dirname(file_url_to_path(import.meta.url)), "..")
const SOURCE = join(ROOT, "apps/realness/src/app/style")
const FILES = ["palette.css", "color.css", "font.css"]
const TARGETS = [".pi/examples/static/static", "apps/realness/tools/publish/renderer/static"]
const SCANNED = [...TARGETS, "apps/plans/static"]

const LITERAL = /oklch\(|#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i

const check = process.argv.includes("--check")
let stale = 0

if (check) {
  for (const target of SCANNED.map((t) => join(ROOT, t)).filter(exists_sync)) {
    for (const file of readdir_sync(target, { recursive: true })) {
      if (!/\.(css|html)$/.test(file) || FILES.includes(file)) continue
      let styling = file.endsWith(".css")
      read_file_sync(join(target, file), "utf8").split("\n").forEach((line, i) => {
        if (/<style\b/.test(line)) styling = true
        if (/<\/style>/.test(line)) styling = false
        if (!styling || !LITERAL.test(line)) return
        console.error(`color literal: ${join(target, file)}:${i + 1}; use a Realness role`)
        stale++
      })
    }
  }
}

for (const target of TARGETS.map((t) => join(ROOT, t)).filter(exists_sync)) {
  for (const file of FILES) {
    const want = read_file_sync(join(SOURCE, file), "utf8")
    const path = join(target, file)
    const have = exists_sync(path) ? read_file_sync(path, "utf8") : null
    if (have === want) continue
    if (check) {
      console.error(`stale: ${path}`)
      stale++
    } else {
      write_file_sync(path, want)
      console.log(`wrote ${path}`)
    }
  }
}
process.exit(stale ? 1 : 0)
