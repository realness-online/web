import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  changed_paths,
  diff_expr,
  file_entries,
  head_copy_path,
  open_expr,
  parse_status,
  with_mention
} from './changes.js'

/**
 * @param {string} id
 * @param {string} name
 * @param {string} path
 */
const call = (id, name, path) => ({
  type: 'message',
  message: { role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: { path } }] }
})

/**
 * @param {string} id
 * @param {number} timestamp
 * @param {boolean} [isError]
 */
const result = (id, timestamp, isError = false) => ({
  type: 'message',
  message: { role: 'toolResult', toolCallId: id, timestamp, isError }
})

test('lists edited and written files, newest first', () => {
  const entries = [
    call('a', 'edit', 'one.js'),
    result('a', 1),
    call('b', 'write', '/abs/two.js'),
    result('b', 2),
    call('c', 'read', 'three.js'),
    result('c', 3),
    call('d', 'edit', 'one.js'),
    result('d', 4)
  ]
  assert.deepEqual(changed_paths(entries, '/repo'), ['/repo/one.js', '/abs/two.js'])
})

test('skips failed edits', () => {
  const entries = [call('a', 'edit', 'one.js'), result('a', 1, true)]
  assert.deepEqual(changed_paths(entries, '/repo'), [])
})

test('reads git status, skipping the old name of a rename', () => {
  const status = parse_status('/repo', ' M a.js\0R  new.js\0old.js\0?? b.js\0')
  assert.deepEqual(
    [...status],
    [
      ['/repo/a.js', 'M'],
      ['/repo/new.js', 'R'],
      ['/repo/b.js', '??']
    ]
  )
})

test('orders session changes, then other changes, then the tree', () => {
  const status = new Map([['/repo/b.js', 'M']])
  const files = file_entries('/repo', ['/repo/a.js'], status, ['/repo/c.js', '/repo/b.js', '/repo/a.js'])
  assert.deepEqual(
    files.map(file => file.label),
    ['a.js [session]', 'b.js [M]', 'c.js']
  )
})

test('adds an @ mention to the prompt', () => {
  assert.equal(with_mention('', 'a.js'), '@a.js')
  assert.equal(with_mention('look at', 'a.js'), 'look at @a.js')
  assert.equal(with_mention('look at ', 'a.js'), 'look at @a.js')
})

test('opens a file in a new tab', () => {
  assert.equal(open_expr('/repo/a.js'), `execute(['tabedit ' . fnameescape("/repo/a.js"), 'redraw!'])`)
})

test('keeps HEAD copies under artifacts/files-diff', () => {
  assert.equal(head_copy_path('/repo', '/repo/work/a.js'), '/repo/artifacts/files-diff/work/a.js')
})

test('diffs the file against its HEAD copy in a new tab', () => {
  assert.equal(
    diff_expr('/repo/a b.js', '/repo/artifacts/files-diff/a b.js'),
    `execute(['tabedit ' . fnameescape("/repo/a b.js"), 'diffsplit ' . fnameescape("/repo/artifacts/files-diff/a b.js"), 'redraw!'])`
  )
})
