import assert from 'node:assert/strict'
import { it } from 'node:test'
import { build_choice, changed_pages } from '../../plans/plans.js'

const owned = new Map([
  [
    'realness',
    {
      id: '/+1/plans/1',
      files: new Set(['Projects/realness.md', 'Areas/Note.md']),
      folders: new Set()
    }
  ],
  [
    'scouts',
    {
      id: '/+1/plans/2',
      files: new Set(['Projects/Scouts/index.md']),
      folders: new Set(['Projects/Scouts'])
    }
  ]
])

const slugs = changed => changed_pages(owned, changed).map(({ slug }) => slug)

it('a changed plan, its linked note, and a note in its folder each reach that plan', () => {
  assert.deepEqual(slugs(['Projects/realness.md']), ['realness'])
  assert.deepEqual(slugs(['Areas/Note.md']), ['realness'])
  assert.deepEqual(slugs(['Projects/Scouts/Realness/Leads/2026-11-05.md']), ['scouts'])
})

it('a save two plans reach names both, and a file outside them names none', () => {
  assert.deepEqual(slugs(['Projects/realness.md', 'Projects/Scouts/index.md']), ['realness', 'scouts'])
  assert.deepEqual(slugs(['Journal/2026-11-05.md']), [])
})

it('a saved blog post rebuilds everything even when no plan changed', () => {
  const built = () => true
  assert.equal(build_choice({ sources_unchanged: true, plan_pages: [], blog_pages: [{ slug: 'post' }], built }), 'all')
  assert.equal(build_choice({ sources_unchanged: true, plan_pages: [], blog_pages: [], built }), 'none')
  assert.equal(
    build_choice({ sources_unchanged: true, plan_pages: [{ id: '/+1/plans/1' }], blog_pages: [], built }),
    'pages'
  )
})
