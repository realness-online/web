/**
 * v3a: the app shows a tool page from the vault, as that page wrote it.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { page_body, page_title, tool_page } from '#root/src/sync/vault-pages.js'

const PAGE = `<!doctype html>
<html itemid="/+1555/pages/1">
  <head><title>Commands</title></head>
  <body>
    <main>
      <template src="/partials/header.fragment"></template>
      <article itemid="/+1555/pages/1">
        <figure><figcaption><h1 itemprop="headline">Every command</h1></figcaption></figure>
        <section itemprop="articleBody">
          <p>What it does</p>
          <pre class="mermaid">flowchart LR</pre>
        </section>
      </article>
    </main>
    <script type="module" src="/scripts/pwa.js"></script>
  </body>
</html>`

it('names a tool page by its headline, then its title', () => {
  assert.equal(
    page_title('Areas/Realness/pages/commands.html', PAGE),
    'Every command'
  )
  assert.equal(
    page_title(
      'Areas/Realness/pages/commands.html',
      PAGE.replace(' itemprop="headline"', '')
    ),
    'Commands'
  )
})

it('takes the page body alone, with no script and no site chrome', () => {
  const body = page_body(PAGE)
  assert.match(body, /What it does/)
  assert.match(body, /class="mermaid"/)
  assert.doesNotMatch(body, /<script/)
  assert.doesNotMatch(body, /pwa\.js/)
  assert.doesNotMatch(body, /partials\/header/)
})

it('takes an article with no article body section, as the session map has', () => {
  const bare = `<!doctype html><html><body>
    <article>
      <header><h1 itemprop="name">Sessions</h1></header>
      <section><h2>1. Who receives the work</h2></section>
    </article>
    <address itemprop="author">+1555</address>
  </body></html>`
  const body = page_body(bare)
  assert.match(body, /Who receives the work/)
  assert.doesNotMatch(body, /<address/)
})

it('reads a page nested in the maps folder, and skips anything else', () => {
  assert.equal(
    tool_page('Areas/Realness/pages/maps/ways-in.html', PAGE)?.path,
    'Areas/Realness/pages/maps/ways-in.html'
  )
  assert.equal(tool_page('Areas/Realness/pages/commands.css', PAGE), null)
  assert.equal(tool_page('Projects/realness-hosting.md', PAGE), null)
})
