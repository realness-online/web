# terminal

A terminal in the browser. Ghostty's parser, libghostty-vt, runs as WebAssembly
and holds the screen; `src/render-canvas.js` draws it on a canvas. Keys and
paste go through the engine's encoder, and selection and scrollback come from
its state.

```sh
npm install
npm run dev     # opens pi in the page; TERMINAL_COMMAND=bash npm run dev for a shell
npm test        # replays captured pi streams through the engine
npm run build   # dist/, relative URLs, serve it under any path
```

In dev, `bridge.py` runs the command in a pty and Vite proxies `/pty` to it.
Hosted, the Brayness orchestrator serves `dist/` and its own `/pty`, and
`?session=<id>` picks the hosted session. Each connection starts a new Pi
conversation in that session. `/remember <words>` searches saved conversations;
refresh does not send them all to the model. Both speak the same JSON frames.

`public/ghostty-vt.wasm` is committed. `npm run build:wasm` rebuilds it from the
pinned Ghostty commit and Zig version (Apple silicon only).

`window.brayness.screen_text()` returns the screen as text, for checks that
read text rather than pixels.
