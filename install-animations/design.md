# Realness — Install Walkthroughs · Design

Synthetic recreations of the "Add to Home Screen / Add to Dock / Install" flow for
each device + browser. Two palettes are in play and must not be mixed:

1. **Framing layer** — Realness brand. Title cards, captions, callout rings, the
   background behind the device. Use these.
2. **Device chrome** — accurate native OS UI (iOS / Android / browser). These are NOT
   brand colors; they exist so the share sheet, toolbar, and dialogs read as the real
   thing. Realness runs as a dark-mode app, so device UI is rendered in **dark mode**.

## Framing palette (Realness brand)

| Token         | Hex       | Use                                            |
| ------------- | --------- | ---------------------------------------------- |
| atmosphere    | `#0e0c09` | Page background behind the device              |
| surface       | `#2c2c26` | Title-card panels, caption bars                |
| text          | `#d7d6cb` | Primary warm off-white text                    |
| text-dim      | `#8d8b7e` | Secondary / device-tag text                    |
| teal (accent) | `#77c5c5` | Primary accent — callout rings, progress, CTAs |
| teal-fill     | `#509595` | Deeper teal fill                               |
| red (accent)  | `#c57777` | Secondary accent — sparingly                   |
| red-fill      | `#955050` | Deeper red fill                                |

Mosaic earth tones (the app-icon family — use only if an accent beyond teal is needed):
sediment `#bc7b4e`, sand `#bfa969`, gravel `#918064`, rocks `#67594c`, boulders `#865050`.

## Device chrome palette (accurate iOS dark mode)

| Token       | Hex       | Use                                       |
| ----------- | --------- | ----------------------------------------- |
| ios-bg      | `#000000` | True-black behind sheets                  |
| ios-sheet   | `#1c1c1e` | Share sheet / dialog background           |
| ios-row     | `#2c2c2e` | Grouped list rows                         |
| ios-row-sep | `#38383a` | Hairline separators                       |
| ios-bar     | `#161618` | Safari toolbar / nav bar                  |
| ios-label   | `#ffffff` | Primary label text                        |
| ios-label-2 | `#98989f` | Secondary label text                      |
| ios-blue    | `#0a84ff` | System tint — Add / Cancel / active icons |
| ios-field   | `#1c1c1e` | Address field background                  |

Android (Material 3 dark, for the Android flows): surface `#1c1b1f`, surface-container
`#211f26`, on-surface `#e6e1e9`, primary `#d0bcff`, outline `#49454f`.

## Type

- UI / device chrome: `-apple-system`, fall back to **Inter** (built-in). iOS uses SF;
  Inter is the closest available substitute — acceptable for a recreation.
- Captions & titles: **Inter**, 600–700 weight. Tabular nums on any step counters.
- Caption body ≥ 40px, titles ≥ 80px (portrait 1080×1920 renders).

## Motion

- Callout ring: teal `#77c5c5`, a soft pulsing ring that settles on the tap target,
  then a quick scale-down "tap" at the moment of action.
- Sheets slide up with `power3.out`; dialogs scale-fade in with `back.out(1.2)`.
- One gesture per scene. The viewer's eye follows the ring; the caption names the action.

## What NOT to do

- Don't tint the iOS/Android chrome with brand teal/red — chrome stays native.
- Don't invent system colors — use the device tables above.
- Don't show more than one tap target lit at a time.
- Don't use jump cuts between scenes — every scene transitions, entrances only.
