---
name: web-md
description: Read web pages as compact markdown instead of raw HTML or full browser snapshots. Use when you need to read, research, summarize, or quote content from a URL, compare several pages, or check docs online. A plain fetch runs first; agent-browser or Firecrawl renders the page only when it needs JavaScript. Not for clicking, filling forms, or logging in - use agent-browser for those.
metadata:
  check: "node ../../bin/web/web-md.js 2>&1 | grep -q usage"
---

# web-md

`.pi/bin/web/web-md.js` turns a URL into readable markdown. It strips scripts,
styles, images, nav, citation markers, and (by default) link URLs, so the model only sees text.

```bash
.pi/bin/web/web-md.js <url> [--max 8000] [--grep word] [--browser] [--firecrawl] [--fresh] [--max-age 24] [--links]
```

| Flag          | Effect                                                        |
| ------------- | ------------------------------------------------------------- |
| `--max N`     | Hard character cap (default 8000). Header says when cut.      |
| `--grep word` | Keep only paragraphs matching the regex, plus their headings. |
| `--browser`   | Skip the static fetch; render with agent-browser.             |
| `--firecrawl` | Skip the static fetch; render with Firecrawl.                 |
| `--fresh`     | Ignore the kept page and read it again.                       |
| `--max-age H` | Hours a kept page counts as current; overrides every rule.    |
| `--links`     | Keep `[text](url)` links; default keeps link text only.       |

The first line is the title. The second line is a comment with the URL,
the source (`static`, `browser`, `firecrawl`, `cached <method> <date>`,
`cached <method>, not modified`, or `blocked`), and the full length, e.g.
`<!-- https://x.com | static | 19969 chars, cut to 8000 -->`.

Exit 3 means the page needed rendering and none was available or it failed;
say so rather than guessing the content. A `blocked` source exits with code 2: the site served a bot check, captcha,
or empty page. Do not treat it as page content. Find the same facts
elsewhere (a mirror, an API, a search result), or tell the user.

## How it decides

1. **Static fetch** (no JavaScript, 15 s timeout, regular Chrome user agent),
   conditional on the kept page: `304 Not Modified` serves the kept copy.
2. Remove overlays, then Readability and Turndown make markdown. If
   Readability keeps under 20% of the page text, use the whole body.
3. Under 400 characters is **thin** (needs JavaScript); a bot check is
   **blocked**. Either way, a kept page that is still current is served.
4. Otherwise render: **agent-browser** if installed (a slow page is read as
   far as it has rendered; a challenge page gets one 5 s retry), then
   **Firecrawl** if `FIRECRAWL_API_KEY` is set.
5. Nothing worked: exit 2 if a method saw a bot check, else exit 3 with
   each method's reason (`web-md: render failed: static: thin; browser: not here`).

## The cache

`.pi/bin/lib/web-md-cache.js` keeps every page read, by any method, in the
harness's artifacts folder under web-md/cache (`WEB_MD_CACHE` overrides): one file per URL with
the page, its validators, the last 20 attempts, and its learned cache time;
one file per site with each method's record there.

**Current or not.** A matching `ETag` or `Last-Modified` from the static
fetch means current, a changed one means read again. Otherwise the page's
age is held to its cache time, the first of:

1. `--max-age <hours>` from the caller (`--fresh` skips the cache).
2. The page's `Cache-Control` (`no-store` is never kept; `max-age`) or `Expires`.
3. A never-keep rule (search results).
4. What re-checks taught this page: re-read after expiring by the same
   method, unchanged doubles its time and changed halves it (15 min to 90 days).
5. The rule for its kind of URL in `.pi/bin/lib/web-md-cache-times.json`
   (pinned versions, front pages, products, reference docs), else 24 hours.

**Sites learn their methods.** A method that fails three times in a row on
a site is skipped there for a week, then tried again. A renderer missing on
this machine never counts against a site.

**Keeping the rules.** Add a kind of page to `web-md-cache-times.json` when
a site's pages go stale too fast or re-render too often; first match wins.
Run `node --test .pi/bin/specs/lib/web-md-cache.spec.js` after changing either file.

## The read log

Each run appends one line to `artifacts/web-md/log/<UTC day>.jsonl`
(`WEB_MD_LOG` overrides): outcome, this run's attempts, and whether the page
was read before. URL and site are sha256 hashes; no page text is kept.
`npm run web-md:report [day]` counts a day by outcome, method, and repeat.

When a kept copy existed, the line also carries `kept`: its age, the cache
time in force and the rule that set it, whether it had an ETag or
Last-Modified, and, on a re-read, whether the text changed and whether the
validators still matched. `npm run web-md:times -- [--days 30] [--by-site]`
judges cache times from those lines: mostly unchanged re-reads mean a time
is too short, frequent changes mean too long, and matched validators with
changed text mean a site's ETag can't be trusted.

Keeping: a page with an ETag or Last-Modified stays until a re-read replaces
it. One without is dropped after 30 days unread (`npm run web-md:prune`);
its attempts stay. A 404 or 410 is never sent to Firecrawl.

## Use it from codemode

Fetch pages in parallel inside codemode and return only what you need.
The raw HTML never enters context. In a hosted actor (two vCPUs, 512 MiB),
read one page at a time: each run takes about 100 MB, and three at once
stall the actor.

```js
const urls = ["https://a.com/docs", "https://b.com/post"];
const rs = await Promise.allSettled(
  urls.map((u) =>
    tools.bash({
      command: `.pi/bin/web/web-md.js ${u} --max 4000 2>/dev/null`,
      timeout: 60,
    }),
  ),
);
return rs
  .map((r, i) => (r.status === "fulfilled" ? r.value.output : `ERR ${urls[i]}`))
  .join("\n\n");
```

- Start with a small `--max` (2000-4000). Fetch more only if the header shows content was cut.
- Use `--grep` to find a fact in a long page instead of reading it all.
- Quote URLs that contain `&` or `?` in the shell command.

## Troubleshooting

| Symptom                                  | Fix                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Output is a cookie banner or footer      | Retry with `--browser`, or `--firecrawl` without agent-browser.      |
| Need link targets (citing, crawling)     | Add `--links`.                                                       |
| `--grep` returns nothing                 | Try a broader regex. Matching is per paragraph and case-insensitive. |
| `blocked` (NYT, Economist, Etsy, Amazon) | Bot wall or paywall. Find the facts elsewhere.                       |
| Takes about 30 s                         | Static fetch was blocked; the browser waited on ads. Normal.         |
| Login-only content                       | Out of scope; use agent-browser with a saved session.                |
