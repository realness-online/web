import assert from 'node:assert/strict'
import { test } from 'node:test'
import { review_origin, review_prompt } from './prompts.js'

test('a session review names only the session files', () => {
  const prompt = review_prompt({ type: 'session', paths: ['a.js', 'b/c.js'] })
  assert.match(prompt, /^# Review/)
  assert.match(prompt, /\n- a\.js\n- b\/c\.js$/)
})

test('a branch review diffs against the merge base', () => {
  const prompt = review_prompt({ type: 'branch', branch: 'main', base: 'abc123' })
  assert.match(prompt, /against branch 'main'.*git diff abc123/)
})

test('a commit review names the commit', () => {
  assert.match(review_prompt({ type: 'commit', sha: 'abc123' }), /commit abc123 introduced/)
})

test('the review branch knows its origin; the work branch has none', () => {
  const work = [{ type: 'message', id: 'm1' }]
  const review = [...work, { type: 'custom', customType: 'review-session', data: { origin: 'm9' } }]
  assert.equal(review_origin(work), undefined)
  assert.equal(review_origin(review), 'm9')
})
