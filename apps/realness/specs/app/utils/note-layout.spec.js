/**
 * f1: a note's `layout:` line frames it in the browser, styles inside.
 */
import { expect, it } from 'vite-plus/test'
import { framed_note } from '@/utils/note-layout'

const note = layout => ({
  itemid: '/+15555550123/plans/1',
  path: 'Areas/a.md',
  title: 'Field Notes',
  created: '2026-11-20',
  layout,
  text: '# Field notes\n\nOne long paragraph.\n'
})

it('frames an article note as a whole page, styles inside', async () => {
  const page = await framed_note(note('article'))
  expect(page).toMatch(/^<!doctype html>/)
  expect(page.match(/<h1/g)).toHaveLength(1)
  expect(page).toMatch(/<h1 itemprop="headline">Field Notes<\/h1>/)
  expect(page).toMatch(/<p>One long paragraph.<\/p>/)
  expect(page).toMatch(/tel:\+15555550123/)
  expect(page).not.toMatch(/href="\/layouts\/article.css"/)
  expect(page).toMatch(/<style>[\s\S]*<\/style>/)
})

it('puts the deck script inside the page', async () => {
  const page = await framed_note(note('deck'))
  expect(page).not.toMatch(/src="\/layouts\/deck.js"/)
  expect(page).toMatch(/<script type="module">[\s\S]+<\/script>/)
})

it('leaves a note with no layout, or the app layout, to the app', async () => {
  expect(await framed_note(note(''))).toBeNull()
  expect(await framed_note(note('app'))).toBeNull()
})

it('refuses a layout it does not know', async () => {
  await expect(framed_note(note('poster'))).rejects.toThrow(
    /unsupported layout: poster/
  )
})
