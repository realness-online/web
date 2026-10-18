# Examples

Optional references; Pi starts without them. The product reads them through
the compatibility link `apps/realness/tools/examples`.

One folder per example. Each is a complete npm package that runs on its own.
`static` ships in the starter. Try it with:

```sh
cd .pi/examples/<name> && npm install && npm run dev
```

| Example  | What it is                                                                 |
| -------- | -------------------------------------------------------------------------- |
| `static` | Markdown articles as semantic HTML: partials, microdata, previews, sitemap |

An app starter is the product itself, not a copy: `apps/realness/frontend`.
`future/` holds ideas, not runnable packages.

## Decisions

- One folder per example; each runs alone.
- Sessions copy from the starter, and install only when asked.
- `@realness.online/itemid` and `/store` release by tag via OIDC.
- Pin `@comark/html` 0.4.0; 0.7 drops `render`.

## Future

Briefs for examples not built yet, in `future/`:

| Brief                                     | What it is                                                    |
| ----------------------------------------- | ------------------------------------------------------------- |
| [`vacation-sf.md`](future/vacation-sf.md) | A shop for a North Beach vintage store: items, cart, checkout |
| [`admin-hub.md`](future/admin-hub.md)     | A personal admin hub each owner can build and publish         |
| [`docs.md`](future/docs.md)               | One markdown file as a page, as raw markdown, and as a dialog |
| [`emotion.md`](future/emotion.md)         | An app that names the emotion in text, billed to its owner    |
