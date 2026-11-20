import assert from 'node:assert/strict'
import { it } from 'node:test'
import { scout_prompt } from '../../src/scouts/prompt.js'

const brief_for = text =>
  scout_prompt({
    label: 'seeq-leads',
    profile: 'p',
    sources: text,
    source: { title: 'Calls', text },
    seen: [],
    nodes: [],
    run_dir: '/run',
    vault_dir: '/vault',
    folder: 'f'
  })

const NEWS = `## 2. Calls

- \`https://news.google.com/rss/search?q=rfp+health\`

Open a story from a feed at \`https://news.google.com/rss/articles/<id>\`.
Search again only on \`https://news.google.com/rss/search?q=<words>\`.
`

it('a public source reads with no --site and no placeholder in the command', () => {
  const brief = brief_for(NEWS)
  assert.match(brief, /Run `realness-read <url>`/)
  assert.doesNotMatch(brief, /--site <site>/)
  assert.doesNotMatch(brief, /--site news/)
})

it('a half URL is a pattern to follow, never a page to read', () => {
  const brief = brief_for(NEWS)
  const pages = brief.slice(
    brief.indexOf('page below.'),
    brief.indexOf('You may also read')
  )
  assert.match(
    pages,
    /- https:\/\/news\.google\.com\/rss\/search\?q=rfp\+health/
  )
  assert.doesNotMatch(pages, /rss\/articles\/\n/)
  assert.doesNotMatch(pages, /search\?q=\n/)
  assert.match(brief, /- https:\/\/news\.google\.com\/rss\/articles\/<id>/)
  assert.match(brief, /- https:\/\/news\.google\.com\/rss\/search\?q=<words>/)
})

it('the brief never forbids the pages it lists', () => {
  const brief = brief_for(NEWS)
  assert.doesNotMatch(brief, /Opening a posting/)
  assert.match(brief, /Read only the pages above\. Any other page ends the run/)
})

it('a login source keeps its own site slug', () => {
  const brief = brief_for(`## 1. YC

    realness-read --site yc https://www.workatastartup.com/
`)
  assert.match(brief, /Run `realness-read --site yc --brief <url>`/)
})

it('the brief tells the agent the reader is ready', () => {
  assert.match(brief_for(NEWS), /`realness-read` is installed and ready/)
})

it('the brief puts the finds write before the summary', () => {
  const brief = scout_prompt({
    label: 'realness-leads',
    profile: 'p',
    sources: NEWS,
    source: { title: 'Calls', text: NEWS },
    nodes: [],
    run_dir: '/run',
    vault_dir: '/vault',
    folder: 'f'
  })
  assert.match(brief, /After you write it, finish with a short summary/)
})
