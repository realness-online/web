/**
 * s1: two copies of one Pi session become one file. Pi sessions are one
 * entry per line, each with an id, and they only grow, so a merge keeps
 * every line of ours in order and adds each line of theirs whose id ours
 * lacks. Entries link by parentId, so order between branches is free.
 *
 * Works on `.jsonl`, `.html`, and `.html.gz` (gzip members of HTML lines).
 * Anything that does not read as a whole session returns null, and the
 * caller keeps both copies as before.
 */
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from "node:zlib"

const HTML_ROW = /^<article itemscope itemtype="\/sessions\/[^"]*" itemid="([^"]+)"/

/** The id a session line names, or null when the line is not a session entry. */
const row_id = (line, html) => {
  if (html) return line.match(HTML_ROW)?.[1] ?? null
  try {
    const entry = JSON.parse(line)
    if (!entry || typeof entry !== "object") return null
    return typeof entry.id === "string" ? `${entry.type}/${entry.id}` : `line/${line}`
  } catch {
    return null
  }
}

const rows = (text, html) => {
  if (!text.endsWith("\n")) return null
  const lines = text.split("\n").slice(0, -1)
  const out = []
  for (const line of lines) {
    if (!line.trim()) continue
    const id = row_id(line, html)
    if (!id) return null
    out.push({ id, line })
  }
  return out.length ? out : null
}

const decode = (name, bytes) => {
  if (!name.endsWith(".gz")) return bytes.toString("utf8")
  try {
    return gunzip_sync(bytes).toString("utf8")
  } catch {
    // A torn tail from a live writer: leave it to keep-both.
    return null
  }
}

/** Ours plus theirs as one session, or null when either side is not a session. */
export const merge_session = (name, ours, theirs) => {
  if (!/\.(jsonl|html|html\.gz)$/.test(name)) return null
  const html = !name.endsWith(".jsonl")
  const a_text = decode(name, ours)
  const b_text = decode(name, theirs)
  if (a_text === null || b_text === null) return null
  const a = rows(a_text, html)
  const b = rows(b_text, html)
  if (!a || !b) return null
  // Both copies must be the same session: the first line is its header.
  if (a[0].id !== b[0].id) return null
  const seen = new Set(a.map((row) => row.id))
  const extra = b.filter((row) => !seen.has(row.id) && seen.add(row.id))
  const text = [...a, ...extra].map((row) => `${row.line}\n`).join("")
  return name.endsWith(".gz") ? gzip_sync(text) : Buffer.from(text)
}
