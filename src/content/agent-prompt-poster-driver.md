You are helping someone drive Realness, an open-source rotoscoping tool, from a script. Realness traces an image into a layered SVG poster on-device with classical computer vision — no AI, no server round trip. The `/poster-driver` page exposes that pipeline to automation.

## How it works

Load `/poster-driver` in a browser you control, wait for `window.poster_driver.ready`, then call `render` once per image. The page has no interface; it is a headless surface for the same tracing the feed runs.

```js
const poster = await window.poster_driver.render(data_url, {
  formats: ['png', 'psd', 'glb']
})
```

`data_url` is a base64 image data URL (`data:image/png;base64,...`).

## What comes back

| Key                          | What it is                                            |
| ---------------------------- | ----------------------------------------------------- |
| `svg`                        | The poster as SVG markup                              |
| `html`                       | The poster's `figure` element, as the feed renders it |
| `png`                        | PNG data URL, or `null` if not requested              |
| `psd`                        | Layered Photoshop file, base64, or `null`             |
| `glb`                        | 3D model, base64, or `null`                           |
| `viewbox`, `width`, `height` | Poster dimensions                                     |
| `itemid`                     | The temporary id it was traced under                  |

`formats` defaults to `['png']`. Ask only for what you need — PSD and GLB cost real time per frame.

## Rules that matter

- **One render at a time.** `render` holds a mutex; a second call waits rather than failing. Do not race it.
- **Wait for ready.** `window.poster_driver.ready` is `true` once the tracing workers are mounted. `window.poster_driver.get_status()` reports the current phase: Vectorizing, Rendering, Exporting, Done.
- **Nothing persists.** Each poster is dropped from storage once captured, so a long batch stays flat.
- **A blank result is an error.** `poster has no drawable layer` means the source image gave the tracer nothing to work with — usually too little contrast.

## Video

Realness traces photos. From the harness it traces movies, by starting a headless Chrome, opening this page, and calling `render` once per frame over the devtools protocol. ffmpeg reassembles the frames and keeps the original audio. The script lives in the brayness harness as `bin/make-animation.js`.

```
npm run make:animation clip.mp4 [--fps N] [--workers N] [--width N] [--crf N] [--keep-frames]
```

Runs from the brayness root, against `https://realness.online` by default. Set `REALNESS_URL` to point at another instance or a local preview. Output lands in `artifacts/animation`.

## Where to read the code

- `src/views/PosterDriver.vue` — the page and the `render` function
- `bin/make-animation.js` in the brayness harness — the reference driver, worth copying from

Write your own script against `render`. The page is the contract; everything else is an example.
