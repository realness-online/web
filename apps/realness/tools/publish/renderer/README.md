# Static renderer

```sh
npm ci
npm run build
npm run dev
npm test
```

Run `build.js` from a site folder. Its `site.json`, `content/articles`,
`static`, `partials`, and optional `pages` supply the inputs.

`site.json` selects `type: "blog"` (default) or `type: "plans"`.
Both keep `/blog/<slug>` routes. Plans use linked covers and modification-time
ordering; blogs use expandable articles and publication dates.

## Source

- `build.js`: command entry
- `src/build.js`: clean snapshot and asset assembly
- `src/pages.js`: article, index, page, and sitemap output
- `src/templates.js`: binds build settings to templates
- `src/templates/`: shell, figure, article, index, and sitemap
- `src/markdown.js`: code, cards, plates, and print notes
- `src/images.js`: poster dimensions and social-preview images
- `src/watch.js`: serialized rebuilds
- `static/plans.css`: native nested CSS
- `static/scripts/plan-*.js`: cover and diagram interaction

Node imports use `#root/`, mapped in `package.json`. Browser modules keep
relative imports; browsers do not read package import maps.

Mermaid and the HTML polyfill come from installed dependencies. Builds make
no CDN requests. Image caches belong to a single build.

Metadata and labels are escaped as text. Article bodies, partials, custom
pages, and `site.head` are author-controlled HTML, not a sandbox for strangers.
