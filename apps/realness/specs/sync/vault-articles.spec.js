/**
 * v4: a blog note becomes one row of the blog index.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { article_summary, newest_first } from '#root/src/sync/vault-articles.js'

const NOTE = `---
itemid: "/+1555/articles/1"
title: "A Post"
created: 2024-11-17
description: "What it says"
---

# A Heading
`

it('reads an article: title, created, and description', () => {
  assert.deepEqual(article_summary('Areas/Blog/A Post.md', NOTE), {
    itemid: '/+1555/articles/1',
    path: 'Areas/Blog/A Post.md',
    title: 'A Post',
    created: '2024-11-17',
    description: 'What it says'
  })
})

it('falls back to the heading, then the filename', () => {
  const heading = NOTE.replace('title: "A Post"\n', '')
  assert.equal(article_summary('Areas/Blog/x.md', heading)?.title, 'A Heading')
  const bare = '---\nitemid: "/+1555/articles/2"\n---\n\nNo heading here.\n'
  assert.equal(
    article_summary('Areas/Blog/plain note.md', bare)?.title,
    'plain note'
  )
})

it('skips a note that is not an article', () => {
  assert.equal(article_summary('Projects/post.md', NOTE), null)
  assert.equal(
    article_summary(
      'Areas/Blog/plan.md',
      NOTE.replace('/articles/1', '/plans/1')
    ),
    null
  )
  assert.equal(article_summary('Areas/Blog/no-id.md', '# No id\n'), null)
})

it('puts the newest article first', () => {
  const one = { title: 'One', created: '2024-01-01' }
  const two = { title: 'Two', created: '2026-01-01' }
  assert.deepEqual(
    newest_first([one, two]).map(a => a.title),
    ['Two', 'One']
  )
})
