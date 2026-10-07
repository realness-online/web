# Examples

One folder per example. Each is a complete npm package that runs on its own.
`static` and `app` ship in the starter; `chat` and `terminal` build into the
host. Try one with:

```sh
cd tools/examples/<name> && npm install && npm run dev
```

| Example    | What it is                                                                          |
| ---------- | ----------------------------------------------------------------------------------- |
| `terminal` | A terminal in the browser: libghostty-vt as WASM, drawn on a canvas                 |
| `chat`     | HTML chat with hosted Pi, streamed through the actor's chat bridge                  |
| `static`   | Markdown articles as semantic HTML: partials, microdata, previews, sitemap          |
| `app`      | A Vue notes app; each note is a microdata article saved by `@realness.online/store` |

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
