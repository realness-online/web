---
name: realness-read
description: Read web pages as compact markdown instead of raw HTML or full browser snapshots. Use when you need to read, research, summarize, or quote content from a URL, compare several pages, or check docs online. A Common Crawl copy is read first, then the site itself; agent-browser or Firecrawl renders the page only when it needs JavaScript. Not for clicking, filling forms, or logging in - use agent-browser for those.
metadata:
  check: 'node ../../../apps/realness/server/halo/guest/realness-read.js 2>&1 | grep -q usage'
---

# realness-read

`.pi/bin/web/realness-read` turns a URL into readable markdown. In a box the
command is `realness-read`. It strips scripts, styles, images, nav, citation
markers, and (by default) link URLs, so the model only sees text.

```bash
.pi/bin/web/realness-read <url> [--max 8000] [--grep word] [--links] [--fresh] [--site <slug>] [--brief] [--json]
```

| Flag          | Effect                                                        |
| ------------- | ------------------------------------------------------------- |
| `--max N`     | Hard character cap (default 8000). Header says when cut.      |
| `--grep word` | Keep only paragraphs matching the regex, plus their headings. |
| `--links`     | Keep `[text](url)` links; default keeps link text only.       |
| `--fresh`     | Read the site itself: no kept page, no Common Crawl copy.     |
| `--site slug` | Read signed in with that site's saved login and scout code.   |
| `--brief`     | Print the page's raw body only.                               |
| `--json`      | Print the whole reply as JSON.                                |

The first line is the title. The second line is a comment with the URL,
the source, and the full length, e.g.
`<!-- https://x.com | commoncrawl 20261016 | 19969 chars, cut to 8000 -->`.
Sources: `commoncrawl <crawl day>`, `static`, `chrome`, `firecrawl`,
`scout`, or `cache` / `stale` followed by the method that read it.

Exit 2 means a bot check, captcha, or empty page: do not treat it as page
content. Find the same facts elsewhere, or tell the user. Exit 3 means no
method could read the page; say so rather than guessing the content.

## How it decides

One engine, `apps/realness/src/halo/web-engine.js`, reads for the Mac and
for every box. A box asks the halo through the door; the Mac runs the
engine itself, with its cache in `artifacts/realness-read`.

1. Scout code in the vault for the site or host reads first.
2. A kept page that is still current is served.
3. **Common Crawl**: one index lookup in the newest crawl, then one byte
   range of its archive. The site sees no request. Skipped with `--fresh`,
   and for pages that change within a day (front pages, listings, search,
   products).
4. **Static fetch** (15 s timeout). `robots.txt` decides whether the page
   is shared in the cache.
5. Thin (under 200 characters of text) or blocked: render with Chrome
   (agent-browser on the Mac), then **Firecrawl** if `FIRECRAWL_API_KEY` is
   set. A 404 or 410 stops here.

A slow method (Common Crawl, Chrome, Firecrawl) that fails on a site three
times in a row is skipped there for a week.

## The cache

One file per URL in `pages/`, one per site in `sites/`. A page's cache time
is the first of: its `Cache-Control` or `Expires`, a never-keep rule, what
re-reads taught it (unchanged doubles, changed halves), the rule for its
kind of URL in `apps/realness/src/halo/web-times.json`, else 24 hours.

`npm run read:report [day]` counts a day of reads by outcome.
`npm run read:prune` drops pages unread for 30 days.

## Use it from codemode

Fetch pages in parallel inside codemode and return only what you need. In a
hosted actor (two vCPUs, 512 MiB), read one page at a time.

```js
const urls = ['https://a.com/docs', 'https://b.com/post']
const rs = await Promise.allSettled(
  urls.map(u =>
    tools.bash({
      command: `.pi/bin/web/realness-read '${u}' --max 4000 2>/dev/null`,
      timeout: 60
    })
  )
)
return rs
  .map((r, i) => (r.status === 'fulfilled' ? r.value.output : `ERR ${urls[i]}`))
  .join('\n\n')
```

- Start with a small `--max` (2000-4000). Fetch more only if the header shows content was cut.
- Use `--grep` to find a fact in a long page instead of reading it all.
- Quote URLs that contain `&` or `?` in the shell command.
- A `commoncrawl` source can be weeks old. Add `--fresh` when the page must be current.

## Troubleshooting

| Symptom                               | Fix                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| Page is out of date                   | Add `--fresh`.                                                       |
| Need link targets (citing, crawling)  | Add `--links`.                                                       |
| `--grep` returns nothing              | Try a broader regex. Matching is per paragraph and case-insensitive. |
| Exit 2 (NYT, Economist, Etsy, Amazon) | Bot wall or paywall. Find the facts elsewhere.                       |
| Login-only content                    | Use `--site <slug>` with a saved login, or agent-browser.            |
