# Realness Motion Graphics - Design

This is the source of truth for HyperFrames compositions used in `work/web` documentation.
It crystallizes the visual language already living in `src/style/*.styl` so motion graphics
look like they belong to Realness, not next to it.

## Mood

Geological, calm, human-scale. Strata, not stage lighting. Restraint is the
brand: the keyframes in `src/style/keyframes.styl` rotate by 0.22 degrees on
purpose. Posters and avatars are vector cutouts with screentone texture, so
motion graphics should feel like the same hand made them.

When in doubt: subtract. A still title that holds is more Realness than a busy
one that wiggles.

## Palette

Use these as exact values. Names mirror `src/style/variables.styl`.

### Surfaces

| Token              | Hex     | Use                               |
| ------------------ | ------- | --------------------------------- |
| `white-background` | #f6f6ef | Light surface, default canvas     |
| `white-poster`     | #e3e3da | Light surface for poster contexts |
| `white-text`       | #e0e0d4 | Body text on dark                 |
| `black-background` | #2c2c26 | Dark surface                      |
| `haze`             | #0e0c09 | Deepest dark, background tone     |
| `black`            | #525252 | Body text on light (32% gray)     |

### Accents (use sparingly, never both at full intensity)

| Token               | Hex     | Use                       |
| ------------------- | ------- | ------------------------- |
| `blue-fill`         | #509393 | Cool accent (desat teal)  |
| `red-fill`          | #935050 | Warm accent (brick)       |
| `blue-accent-light` | #355757 | Cool on light surface     |
| `red-accent-light`  | #7e4040 | Warm on light surface     |
| `blue-accent-dark`  | #74c1c1 | Cool on dark surface      |
| `red-accent-dark`   | #c17474 | Warm on dark surface      |
| `yellow`            | #f4e021 | Highlight (used at ~0.75) |
| `orange`            | #f49e1c | Highlight (used at ~0.75) |

### Earth (the strata - prefer these for fills, backgrounds, sequenced layers)

| Token      | Hex     | Description   |
| ---------- | ------- | ------------- |
| `sediment` | #c08658 | Warm tan      |
| `sand`     | #ccb277 | Pale tan      |
| `gravel`   | #8d7e65 | Neutral warm  |
| `rocks`    | #67594a | Dark warm     |
| `boulders` | #87504f | Dark warm-red |

When animating the cutout pipeline (5 layers), map them to earth tones in
order: sediment, sand, gravel, rocks, boulders. They already sequence.

## Typography

Lato only. Three weights are subset and live in `public/fonts/` (same files
the app serves):

- `Lato-Light-Subset.woff2` - weight 300 - default for headings
- `Lato-Regular-Subset.woff2` - weight 400 - body, captions
- `Lato-Heavy-Subset.woff2` - weight 800 - reserved for emphasis

Signature rules:

- Headings use **weight 300** with `letter-spacing: -0.02em` and `line-height: 1`
- H3 and below use `letter-spacing: -0.01em`
- Body uses weight 400, line-height 1.33
- Heavy 800 is for a single hero word, never for whole headlines

Scale (modular, 1.250 -> 1.414):

- H1: ~2.4rem at desktop, ~1.6rem at small (~96px / 64px in 1920x1080)
- H2: ~2.0rem / ~1.4rem (~80px / 56px)
- H3: ~1.6rem / ~1.3rem (~64px / 50px)
- Body: 1.125 -> 1.33rem (~45px / ~53px)

Treat the rem-equivalents as approximate; pick a clean px size that reads at
1920x1080 video resolution. Headlines around 96-130px, body around 36-44px.

## Layout

- Base unit: `base-line` is 1.333rem (~21.3px). Use multiples for spacing.
- Density: airy, not dense. Default padding 80-160px on a 1920x1080 frame.
- Max content width: ~22 base-lines (~470px text column at body size).

## Motion

The vocabulary already exists. Match it.

- **Ambient amplitudes are tiny.** Subtle rotation = 0.22deg. Subtle scale =
  1 -> 1.05. Subtle opacity breath = 0.5 -> 1.
- **State changes are full displacement.** Slide-in from 100% off-axis, not
  partial. Use this for scene entrances and exits.
- **Eases:** `power2.out`, `power3.out`, `expo.out` for entrances. `power2.in`
  for exits. No `back`, no `elastic`, no `bounce`. Linear is fine for ambient
  loops.
- **Durations:** entrance tweens 0.4-0.7s, ambient loops 4-12s, scene holds
  3-8s. Avoid sub-200ms unless it's a snap.
- **Stagger:** 80-160ms between siblings.

## Texture

Realness's texture signature is **screentone**, not blur or glow. The app
ships `public/screentones/` with real assets.

- Prefer screentone overlays (PNG with `mix-blend-mode: multiply` on light
  surfaces, or `screen` on dark) over `box-shadow` and `filter: blur`.
- For light depth in HyperFrames, use a faint screentone PNG at 0.15-0.3 opacity.
- If you must use shadow, keep it tight and warm-tinted: `0 2px 0 rgba(14, 12, 9, 0.15)`.

## Corners and Shapes

- Border-radius: 0 (sharp) or 4-8px (subtle). Avoid pill shapes.
- Stroke weight: 1-2px on light backgrounds, 1.5-3px on dark.
- Vector cutouts are the dominant shape. Build illustrations from solid color
  fills with overlap, not gradients.

## What NOT to do

- No full-screen vibrant gradients (the cutout style is solid fills with
  overlap, not gradient ramps)
- No glow-heavy depth (`text-shadow: 0 0 40px ...`)
- No drop shadows for elevation
- No saturated primaries (Realness blue is #509393, not #2563eb)
- No bouncy/elastic eases
- No web-UI density (8/12/16 paddings) - this is a 1.333rem-based system
- No motion blur or radial blur effects
- No more than two accent colors visible at once
- No Heavy 800 for whole headlines (Heavy is for single-word emphasis)

## Defaults Cheatsheet

For a quick title card or doc graphic, this is the safe bet:

```css
body {
  background: #f6f6ef;
  color: #525252;
  font-family: 'Lato', system-ui;
}
h1 {
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1;
  font-size: 120px;
  color: #2c2c26;
}
.subtitle {
  font-weight: 400;
  font-size: 42px;
  color: #525252;
}
.accent {
  color: #509393; /* or #935050 - never both at full strength */
}
```

Dark mode swap: `#0e0c09` background, `#e0e0d4` text, `#74c1c1` / `#c17474` for accents.
