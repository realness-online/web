# Addressed items and generated sites

## Before building

1. Read the project's scripts and existing item and PWA code.
2. Establish the author, vocabulary, source, rendered output, and public route.
3. Reuse the product renderer or example. Keep the site's bespoke composition.
4. Build, run the structural gate, then test browser behavior.
5. Fix a failed gate before publication. Never weaken it to pass a build.

## Identity and context

An itemid names a person, type, and creation time:
`/+16282281824/articles/1791571682897`.

Use `@realness.online/itemid` with the app's declared vocabulary. In this
workspace, the Node adapter is `apps/realness/src/publish/itemid.js`.
Read the author through `person(root)` from the harness settings. Mint an
unaddressed vault file through `mint_item` in `apps/realness/src/publish/sources.js`.
Preserve an existing itemid. Check collisions when minting several items.

- Markdown owns its itemid in frontmatter. SVG and HTML carry it on their root.
- Render Markdown to an article with the same itemid and Schema.org microdata.
- Save HTML at `<output>/<itemid without leading slash>/index.html`.
- Keep public slugs. Identity and the public URL have different jobs.
- A vault scan finds source files by itemid. No separate catalog is needed.
- A move carries identity inside the file. A new authored copy gets a fresh ID.
- Do not migrate merely browsed notes or infer identity from file timestamps.
- The vault can hold references and views of items owned outside it. They supply
  classification context and knowledge about a person. Preserve that identity.
- Realness posters and thoughts can have several vault views. Do not re-mint
  them. An app's `from` pins the view used for rendering; `path` is its output
  asset path. This does not grant access to arbitrary files outside the vault.
- Wrap a binary asset in an addressed page or poster. A referenced binary does
  not need an invented identity.

## Realness defaults

Link the unchanged `palette.css` and `color.css` from
`apps/realness/src/app/style/`. Use their semantic roles in other styles.
Use the spacing and type rules in `realness-instance.md` and `SKILL.md`.

Light mode uses chalk and graphite. Dark mode uses basalt and bone through
`prefers-color-scheme`. Keep `color-scheme: light dark`. Do not add a JavaScript
scheme toggle. Check actual text, controls, posters, and focus states in both
modes; linked files alone do not prove that overrides preserve these values.

## Progressive Web App requirements

Read the existing implementation before selecting an approach:

- `apps/realness/frontend/vite.config.js`: `vite-plugin-pwa`, asset inclusion,
  cache-size limit, excluded online-only terminal WebAssembly, navigation
  fallback exclusions, manifest scope, and 192/512 icons.
- `apps/realness/src/app/main.js`: registration after first paint.
- `apps/realness/src/app/use/reload-on-update.js`: update checks on return,
  activation when hidden and safe, no reload on first install, and protection
  for work and typed input.
- `apps/realness/src/app/use/install.js`: existing install flow.

Reuse this configuration and lifecycle where they apply. Keep scope and paths
correct for the deployment base. Do not copy push or terminal behavior into a
site that does not use it. Read the existing dependency manifest before adding
a plugin; dependency changes require human review.

Ship a linked local manifest with a name, start URL, scope, installed display
mode, and real 192/512 icons. Ship and register a local service worker. Cache
only the site's selected public assets and offline content. Never put private
vault files, authenticated API responses, or secrets in a public cache.

## Verification

Run from the harness root:

```
node bin/soundness-check.js --site <built-directory>
```

Every built HTML page must contain a primary addressed `html`, `main`, or
`article` with microdata. Each addressed article must carry its itemid. Linked
CSS, including local quoted `@import` files, must contain the unchanged Realness
palette and roles. The checker checks manifest fields, icon file presence,
registration text in linked scripts and literal imports, and worker file
presence. The default worker filename is `service.worker.js`; use `--worker`
when the build names it differently.

These are structural checks. A registration string is not evidence that it
runs. Icon presence does not prove dimensions or maskable safe area. CSS file
presence does not prove contrast or prevent later overrides. Run these browser
checks on the shipped build, headless unless the user requests otherwise:

1. Serve on localhost or HTTPS at its real deployment base.
2. Check public slug and itemid routes, navigation, assets, and keyboard focus.
3. Check system light and dark modes at phone and desktop widths.
4. Load online, wait until a worker controls the page, then go offline and
   reload. Check the shell and promised offline content. Show online-only
   actions as unavailable without treating idle states as failures.
5. Verify manifest resolution, icon dimensions, worker scope, and installation
   requirements. Never claim installation was tested from file presence.
6. Publish a second local build. Return to the page and confirm it detects the
   update. Confirm first install does not reload; an update does not discard
   typed input or active work, and activation reloads at most once.
7. Check that private files and API data remain outside public caches.

## Examples

### Happy path: a rendered source

Source `Clippings/example.md`:

```markdown
---
itemid: "/+16282281824/sources/1791571682897"
created: 2026-10-09T11:48:02-07:00
---

# Example
```

Render the following in the site shell, link its local Realness styles and PWA
assets, and save it at both the chosen public route and
`+16282281824/sources/1791571682897/index.html`:

```html
<article
  itemscope
  itemtype="https://schema.org/BlogPosting"
  itemid="/+16282281824/sources/1791571682897"
>
  <h1 itemprop="headline">Example</h1>
  <section itemprop="articleBody"><p>Selected public content.</p></section>
</article>
```

### Robust variant: select one external item's view

Keep both contextual copies. Pin the intended public export without changing
its original identity:

```json
{
  "id": "/+16282281824/posters/1772229663708",
  "from": "Areas/Blog/poster.svg",
  "path": "posters/example.svg"
}
```

Resolve it through the vault scan. Refuse an absent or mismatched view. The
source boundary still refuses path traversal and links outside the vault.

### Anti-pattern and correction

Wrong: mint a new ID while rendering, add a dark-only body color, and report a
site as offline-ready because `service.worker.js` exists.

Correct: keep the source ID, link both Realness style files, run the built-site
gate, and test a worker-controlled offline reload and safe update in a browser.
If browser checks are incomplete, state that they remain unverified.
