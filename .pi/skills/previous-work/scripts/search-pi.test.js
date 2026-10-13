import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sessionJsonlToHtml as session_jsonl_to_html } from '../../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'
import { compress_session_chunk } from '../../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import { search_pi } from './search-pi.js'

test('exact search finds the same rows in JSONL, HTML, and appended gzip', () => {
  const scratch = resolve(import.meta.dirname, '../../../../artifacts/previous-work')
  mkdir_sync(scratch, { recursive: true })
  const dir = mkdtemp_sync(join(scratch, 'search-'))
  try {
    const entries = [{ type: 'session', id: 's' }, { type: 'message', message: { role: 'user', content: 'Markup <&> decision' } }, { type: 'message', message: { role: 'assistant', content: 'Markup <&> result' } }]
    const jsonl = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n'
    const html = session_jsonl_to_html(jsonl, 's')
    write_file_sync(join(dir, 'a.jsonl'), jsonl)
    write_file_sync(join(dir, 'b.html'), html)
    const chunks = html.split('\n').filter(Boolean).map(row => compress_session_chunk(`${row}\n`))
    write_file_sync(join(dir, 'c.html.gz'), Buffer.concat([...chunks, compress_session_chunk('partial\n').subarray(0, 15)]))
    write_file_sync(join(dir, 'c.html.gz.before-compaction-backup'), 'Markup <&>')
    const result = search_pi({ dir, term: 'markup <&>', limit: 10 })
    assert.equal(result.total, 3)
    assert.ok(result.files.every(file => file.count === 2))
    assert.ok(result.files.every(file => file.snippet.includes('Markup <&>')))
    assert.equal(search_pi({ dir, term: 'markup <&>', current_session: 'c.html.gz', limit: 10 }).total, 2)
    assert.equal(search_pi({ dir, term: 'missing', limit: 10 }).total, 0)
  } finally { rm_sync(dir, { recursive: true }) }
})
