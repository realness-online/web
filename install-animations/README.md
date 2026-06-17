# Install walkthrough animations

Synthetic motion graphics that show how to install Realness on each platform.
Built with [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP → MP4) and
served by the app from `public/install/`.

The app picks the right one at runtime — see `src/utils/platform.js` and
`src/components/install-guide.vue`.

| Source (`sources/`)     | Output (`public/install/`) | Serves                                  | Size       |
| ----------------------- | -------------------------- | --------------------------------------- | ---------- |
| `ios-safari.html`       | `ios-safari.mp4`           | iPhone, iPad, all iOS browsers          | 1080×1920  |
| `android-chrome.html`   | `android-chrome.mp4`       | Android Chrome                          | 1080×1920  |
| `desktop-chromium.html` | `desktop-chromium.mp4`     | Desktop Chrome / Edge / Brave (any OS)  | 1920×1080  |
| `macos-safari.html`     | `macos-safari.mp4`         | macOS Safari (Add to Dock)              | 1920×1080  |

Firefox desktop has no install path, so it gets text in the component — no video.

## Prerequisites

- `npx hyperframes` (no install needed; pinned to a version in `package.json`).
- `ffmpeg` for pulling still frames to check element placement.

## Layout

- `sources/*.html` — **the source of truth.** Edit these.
- `index.html` — **scratch.** HyperFrames' `lint`/`inspect` only operate on the
  project's single root `index.html`, so we copy a source into it to work on a flow.
  Don't hand-edit `index.html`; it gets overwritten.
- `design.md` — palette + motion rules (Realness brand for framing, accurate native
  OS colors for the device chrome). Read it before changing visuals.
- `assets/realness-icon.png` — the app icon (copy of `public/512.png`).
- `renders/` — local MP4 output (git-ignored; the shipped copies live in
  `public/install/`).

## Build loop

Work on one flow at a time:

```bash
cd install-animations

# 1. Load a flow into the scratch index.html
cp sources/ios-safari.html index.html

# 2. Validate (errors must be clean; review inspect findings)
npx hyperframes lint
npx hyperframes inspect          # flags text/overflow/occlusion with timestamps

# 3. Render
npx hyperframes render --output renders/ios-safari.mp4

# 4. Publish to the app
cp renders/ios-safari.mp4 ../public/install/ios-safari.mp4
```

You can also render a source directly without the copy:
`npx hyperframes render -c sources/ios-safari.html -o renders/ios-safari.mp4`
(but `lint`/`inspect` still need the `index.html` copy).

When you're done, leave `index.html` as `ios-safari` so `npm run dev` previews something:
`cp sources/ios-safari.html index.html`.

## Placing rings, cursors, and taps

Coordinates for the callout ring/ripple/cursor are pixel values in the composition's
own coordinate space (e.g. 1080×1920). The reliable way to place them is to render,
pull the frame at the tap moment, and read it:

```bash
# crop=W:H:X:Y — pull just the target region at a timestamp
ffmpeg -y -ss 9.3 -i renders/ios-safari.mp4 -frames:v 1 \
  -vf "crop=900:300:90:1640" /tmp/check.png
```

Adjust the inline `style="left:…; top:…"` on `#sN-ring` / `#sN-ripple`, re-render, re-check.

## Conventions baked into the sources

- **Scenes** are `.clip` divs (`#s1`…`#sN`) that crossfade; entrances only, the
  crossfade is the exit (no exit tweens except the final scene).
- **Captions** sit in `.top-band`; one gesture + one caption per scene; step dots track
  progress.
- **Ring/ripple** must default to `opacity: 0` in CSS, and the ripple's `fromTo` must use
  `immediateRender: false` — otherwise GSAP paints their start-state before the tap.
- Cross-scene/transition overlap is marked with `data-layout-allow-overlap` /
  `-overflow` / `-occlusion` so `inspect` stays clean.
- Device chrome uses **accurate native OS colors**, not brand colors (see `design.md`).

## Adding a new flow

1. Copy the closest existing source (portrait → iOS/Android; landscape → desktop/macOS).
2. Rework the scenes for the new UI; keep the ring/caption/step system.
3. Add it to the matrix in `src/utils/platform.js` (`install_method` + `all_methods`).
4. Render, publish to `public/install/`, and wire any new detection branch.
