/**
 * b1: the app's blog pages get the published renderer's own markup, rendered
 * in the browser from the vault's note text.
 */
import { describe, expect, it } from 'vite-plus/test'
import {
  article_html,
  blog_slug,
  index_html,
  poster_size,
  render_note
} from '@/blog/vault-blog'

const note = (title, date, img = '', extra = '') => `---
itemid: "/+1555/articles/${date.replaceAll('-', '')}"
title: ${title}
date: ${date}
${img ? `img: ${img}\n` : ''}${extra}---

Body of ${title}.
`

const SIZES = { 'p.svg': { width: 300, height: 200 } }
const older = () =>
  render_note('Areas/Blog/2026/older.md', note('Older', '2026-01-01'))
const newer = () =>
  render_note('Areas/Blog/2026/newer.md', note('Newer', '2026-02-01', 'p.svg'))
const secret = () =>
  render_note(
    'Areas/Blog/2026/secret.md',
    note('Secret', '2026-03-01', '', 'draft: true\n')
  )

describe('@/blog/vault-blog', () => {
  it('names an article by its file name', () => {
    expect(blog_slug('Areas/Blog/2026/the-harness-is-the-thing.md')).toBe(
      'the-harness-is-the-thing'
    )
  })

  it('reads a poster size from its viewBox', () => {
    expect(poster_size('<svg viewBox="0 0 300 200"></svg>')).toEqual({
      width: 300,
      height: 200
    })
    expect(poster_size('<svg></svg>')).toBe(null)
  })

  it('marks up an article as the published blog does', async () => {
    const html = article_html(await newer(), SIZES)
    expect(html).toMatch(
      /<article itemscope itemid="\/\+1555\/articles\/20260201" itemtype="http:\/\/schema.org\/BlogPosting">/
    )
    expect(html).toMatch(/<h1 itemprop="headline">Newer<\/h1>/)
    expect(html).toMatch(
      /<img src="\/v1\/poster\/p.svg" width="300" height="200"/
    )
    expect(html).toMatch(/<section itemprop="articleBody">[\s\S]*Body of Newer/)
    expect(html).toMatch(/<a class="back-link" href="\/blog"/)
  })

  it('offers a poster button on every card, named for what it does', async () => {
    expect(index_html([await older()], SIZES)).toMatch(
      /<button type="button" class="pick-poster" aria-label="Add a poster">/
    )
    expect(index_html([await newer()], SIZES)).toMatch(
      /<button type="button" class="pick-poster" aria-label="Change poster">/
    )
  })

  it('shows a draft to its owner, marked as a draft', async () => {
    expect(index_html([await older(), await secret()], SIZES)).toMatch(
      /href="\/blog\/secret">Secret<\/a> <mark class="draft">draft<\/mark>/
    )
    expect(article_html(await secret(), SIZES)).toMatch(
      /<h1 itemprop="headline">Secret <mark class="draft">draft<\/mark><\/h1>/
    )
  })

  it('lists articles newest first, each linked by slug', async () => {
    const html = index_html([await older(), await newer()], SIZES)
    expect(html.indexOf('/blog/newer')).toBeLessThan(
      html.indexOf('/blog/older')
    )
    expect(html).toMatch(
      /<summary>[\s\S]*<h2 itemprop="headline"><a itemprop="url" href="\/blog\/older">Older<\/a>/
    )
  })
})
