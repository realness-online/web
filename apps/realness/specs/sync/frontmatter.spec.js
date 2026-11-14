/**
 * b5: frontmatter reads the same whatever quotes a note uses.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  frontmatter_data,
  read_frontmatter,
  split_frontmatter
} from '#root/src/sync/frontmatter.js'

it('reads a bare, a single-quoted, and a double-quoted value alike', () => {
  const bare = frontmatter_data('itemid: /+1555/plans/1')
  const single = frontmatter_data("itemid: '/+1555/plans/1'")
  const double = frontmatter_data('itemid: "/+1555/plans/1"')
  assert.deepEqual(bare, single)
  assert.deepEqual(single, double)
  assert.equal(double.itemid, '/+1555/plans/1')
})

it('keeps a colon and a quote inside a quoted value', () => {
  assert.equal(
    frontmatter_data('title: "Recovery: what\'s next"').title,
    "Recovery: what's next"
  )
})

it('reads a related block as maps, whichever key comes first', () => {
  assert.deepEqual(
    frontmatter_data(
      'related:\n  - title: Recovery\n    href: ../../work/RECOVERY.md\n  - href: realness-a.md\n    title: A\n'
    ).related,
    [
      { title: 'Recovery', href: '../../work/RECOVERY.md' },
      { href: 'realness-a.md', title: 'A' }
    ]
  )
})

it('keeps the body, and reads no frontmatter from a mid-note rule', () => {
  const { body } = read_frontmatter(
    '---\nitemid: x\n---\n\n# T\n\n---\n\nMore\n'
  )
  assert.equal(body, '\n# T\n\n---\n\nMore\n')
  assert.deepEqual(split_frontmatter('# T\n\n---\nitemid: x\n---\n'), {
    front: '',
    body: '# T\n\n---\nitemid: x\n---\n'
  })
})
