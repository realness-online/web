import { existsSync as exists_sync, readFileSync as read_file_sync, readdirSync as readdir_sync, statSync as stat_sync } from 'node:fs'
import { join } from 'node:path'

const fork = await Promise.all([
  import('../../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'),
  import('../../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js')
]).then(([html, gzip]) => ({ html_line_to_entry: html.htmlLineToEntry, read_session_gzip: gzip.read_session_gzip }), () => null)

/** Exact, case-insensitive search over all transcript rows, including decoded HTML and compressed members. */
export const search_pi = ({ dir, term, current_session, recent, limit }) => {
  if (!exists_sync(dir)) return { name: 'pi', missing: dir, total: 0, files: [] }
  const files = []
  const lower = term.toLowerCase()
  const walk = directory => {
    for (const entry of readdir_sync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) { walk(file); continue }
      if (!entry.isFile() || !/\.(jsonl|html|html\.gz)$/.test(entry.name)) continue
      if (current_session && file.includes(current_session)) continue
      if (!fork && !file.endsWith('.jsonl')) continue
      const bytes = read_file_sync(file)
      const text = file.endsWith('.html.gz') ? fork.read_session_gzip(bytes).text : bytes.toString('utf8')
      let count = 0
      let snippet = ''
      for (const raw of text.split('\n')) {
        if (!raw.trim()) continue
        let line = raw
        if (!file.endsWith('.jsonl')) {
          try { line = JSON.stringify(fork.html_line_to_entry(raw)) }
          catch { continue }
        }
        const at = line.toLowerCase().indexOf(lower)
        if (at < 0) continue
        count += 1
        if (!snippet) snippet = line.slice(Math.max(0, at - 80), at + term.length + 80).replace(/\\[nt]/g, ' ').replace(/\\"/g, '"').replace(/\s+/g, ' ').trim().slice(0, 200)
      }
      if (count) files.push({ file, count, mtime: stat_sync(file).mtimeMs, snippet })
    }
  }
  walk(dir)
  files.sort(recent ? (a, b) => b.mtime - a.mtime : (a, b) => b.count - a.count)
  return { name: 'pi', total: files.length, files: files.slice(0, limit) }
}
