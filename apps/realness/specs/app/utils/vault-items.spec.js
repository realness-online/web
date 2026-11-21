import { describe, expect, it } from 'vite-plus/test'
import { item_html } from '#root/lib/items.js'
import {
  articles_html,
  note_html,
  plans_html
} from '#root/src/sync/vault-items.js'
import {
  read_articles,
  read_change,
  read_files,
  read_note,
  read_pages,
  read_plans
} from '@/utils/vault-items'

describe('@/utils/vault-items', () => {
  it('m2: a plan list reads back as the server wrote it', () => {
    const plan = {
      itemid: '/+1/plans/1',
      path: 'Projects/a.md',
      title: 'A',
      area: 'Realness',
      scout: false,
      archived: true,
      diagram: 'flowchart TD',
      nodes: { open: 2, done: 0, active: ['s1'], blocked: [] }
    }
    expect(read_plans(plans_html([plan]))).toEqual([plan])
  })

  it('m2: a note reads back with its related links and link map', () => {
    const note = {
      itemid: null,
      path: 'Projects/a.md',
      title: 'A',
      layout: 'article',
      created: '2026-11-20',
      text: '# A\n\nSee [b](b.md).',
      related: [{ title: 'B', href: '/vault/+1/plans/2' }],
      links: { 'b.md': '/vault/+1/plans/2' }
    }
    expect(read_note(note_html(note))).toEqual(note)
  })

  it('m3: articles and a file read by path read back', () => {
    const article = {
      itemid: '/+1/articles/20260201',
      path: 'Areas/Blog/2026/a.md',
      title: 'A',
      created: '2026-02-01',
      description: 'About A'
    }
    expect(read_articles(articles_html([article]))).toEqual([article])
    expect(
      read_note(note_html({ path: 'pages/a.css', text: 'h2 { color: red; }' }))
        ?.text
    ).toBe('h2 { color: red; }')
  })

  it('m2: an answer with no note reads as nothing', () => {
    expect(read_note('')).toBeNull()
  })

  it('an item that names only its path reads with every default', () => {
    const bare = type => item_html(type, { path: 'a.md' })
    expect(read_plans(bare('plan'))).toEqual([
      {
        itemid: undefined,
        path: 'a.md',
        title: '',
        area: '',
        scout: false,
        archived: false,
        diagram: null,
        nodes: { open: 0, done: 0, active: [], blocked: [] }
      }
    ])
    expect(read_articles(bare('article'))).toEqual([
      {
        itemid: undefined,
        path: 'a.md',
        title: '',
        created: '',
        description: ''
      }
    ])
    expect(read_note(bare('note'))).toEqual({
      itemid: null,
      path: 'a.md',
      title: '',
      layout: '',
      created: '',
      text: '',
      related: [],
      links: {}
    })
    expect(read_pages(bare('page'))).toEqual([{ title: '', path: 'a.md' }])
    expect(read_files(bare('file'))).toEqual([
      { path: 'a.md', name: '', kind: undefined, size: 0, mtime_ms: 0 }
    ])
    expect(read_change(bare('change'))).toBe('a.md')
  })

  it('a related link with no title or address reads as empty words', () => {
    const html = item_html('note', { path: 'a.md', related: [{}, {}] })
    expect(read_note(html)?.related).toEqual([
      { title: '', href: '' },
      { title: '', href: '' }
    ])
  })
})
