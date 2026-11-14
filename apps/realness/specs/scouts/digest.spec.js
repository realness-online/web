import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  day_label,
  digest_block,
  with_digest
} from '../../src/scouts/digest.js'

const lead = (score, org, url = 'https://example.com/a') => ({
  score,
  org,
  url,
  reason: 'why it fits',
  title: `${org} role`
})

const plan = (body = '<small>Dimmed: scored below 6.</small>') =>
  `# Plan\n\n### Finds\n\n<details>\n<summary><strong>Nov 7</strong> <span>1 lead</span></summary>\n<table>\n<tbody>\n<tr><td>9</td><td><a href="https://example.com/old">Old</a></td><td>old reason</td></tr>\n</tbody>\n</table>\n</details>\n\n${body}\n\n### Decisions\n\n- one\n`

it('a day is headed the way the digest heads it', () => {
  assert.equal(day_label('2026-11-08'), 'Nov 8')
  assert.equal(day_label('2026-01-31'), 'Jan 31')
})

it('a day of finds scores above the line first, dimmed below it', () => {
  const block = digest_block({
    date: '2026-11-08',
    leads: [lead(7, 'Above'), lead(4, 'Below'), lead(6, 'Line')]
  })
  assert.match(
    block,
    /<summary><strong>Nov 8<\/strong> <span>3 leads<\/span><\/summary>/
  )
  const first = block.indexOf('Above')
  assert.ok(first < block.indexOf('Line'))
  assert.ok(block.indexOf('Line') < block.indexOf('Below'))
  assert.match(block, /<tbody>\n<tr><td>7<\/td>/)
  assert.equal((block.match(/<tbody>/g) ?? []).length, 2)
  assert.doesNotMatch(block, /&(?!amp;|lt;|gt;|quot;)/)
})

it('a day with nothing above the line still dims every row', () => {
  const block = digest_block({
    date: '2026-11-12',
    leads: [lead(5, 'Below'), lead(2, 'Out')]
  })
  assert.match(block, /<tbody>\n<\/tbody>\n<tbody>\n<tr><td>5<\/td>/)
})

it('a company gets one row, its best opening', () => {
  const block = digest_block({
    date: '2026-11-12',
    leads: [
      lead(3, 'Brickanta', 'https://example.com/1'),
      lead(5, 'Brickanta', 'https://example.com/2'),
      lead(4, 'Other', 'https://example.com/3')
    ]
  })
  assert.equal((block.match(/>Brickanta</g) ?? []).length, 1)
  assert.match(
    block,
    /<td>5<\/td><td><a href="https:\/\/example.com\/2">Brickanta/
  )
  assert.match(block, /<span>2 leads<\/span>/)
})

it('a reason is one line', () => {
  const block = digest_block({
    date: '2026-11-12',
    leads: [
      {
        ...lead(2, 'Arpari'),
        reason: 'No human stake. Down-signal: it is a contract in India.\nMore.'
      }
    ]
  })
  assert.match(block, /<td>No human stake\.<\/td>/)
})

it('today goes first and older days stay as they were', () => {
  const before = plan()
  const after = with_digest(
    before,
    digest_block({ date: '2026-11-08', leads: [lead(7, 'Today')] }),
    '2026-11-08'
  )
  assert.ok(after.indexOf('Nov 8') < after.indexOf('Nov 7'))
  assert.match(after, /old reason/)
  assert.match(after, /Dimmed: scored below 6\./)
  assert.match(after, /### Decisions\n\n- one/)
})

it('a second run the same day replaces that day alone', () => {
  const first = with_digest(
    plan(),
    digest_block({ date: '2026-11-08', leads: [lead(7, 'First')] }),
    '2026-11-08'
  )
  const second = with_digest(
    first,
    digest_block({ date: '2026-11-08', leads: [lead(9, 'Second')] }),
    '2026-11-08'
  )
  assert.doesNotMatch(second, /First/)
  assert.match(second, /Second/)
  assert.equal((second.match(/<strong>Nov 8<\/strong>/g) ?? []).length, 1)
  assert.match(second, /Nov 7/)
})

it('a plan with no ### Finds section keeps its text', () => {
  const text = '# Plan\n\nNo digest here.\n'
  assert.equal(with_digest(text, '<details></details>', '2026-11-08'), text)
})
