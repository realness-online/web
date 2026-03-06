# Poster Pan and Zoom Design

Design conclusions for moving posters around (pan/zoom) across slice mode, storytelling mode, and aspect ratio. For touch and desktop.

## Mode Interplay

| Mode                 | Poster behavior            | Pan/zoom value                              |
| -------------------- | -------------------------- | ------------------------------------------- |
| Grid + meet          | Poster fits in box         | Low; zoom in to inspect details             |
| Grid + slice         | Poster fills, crops        | High; pan shifts the visible crop           |
| Storytelling + meet  | Poster in viewport         | Medium; zoom + pan to explore               |
| Storytelling + slice | Poster fills height, crops | High; pan shifts crop, zoom shows more/less |

Slice mode is where pan is most useful: continuous exploration of the crop.

## Design Principles

- **Two-finger for touch**: pinch = zoom, two-finger drag = pan. One-finger reserved for scroll and tap.
- **Focus for desktop**: when poster has focus, wheel + drag apply to it; otherwise they scroll.
- **Separate scroll from pan**: one finger = scroll, two fingers = pan. Avoids ambiguity in storytelling.
- **Transform-based**: use a wrapper with overflow:hidden and apply `scale(zoom) translate(panX, panY)` to the SVG. Simpler than viewBox manipulation.

## Gesture Priority

1. **Hold (250ms)** — layer selection (existing)
2. **Two-finger move** — pan/zoom (new)
3. **Tap** — meet/slice toggle, menu (existing)

For tap vs drag: if pointer moves before ~100ms, treat as drag; otherwise tap.

## What to Avoid

- One-finger drag for pan in storytelling (conflicts with scroll)
- Long-press to enter pan mode (adds friction)
- viewBox manipulation (complex with slice/meet and animations)

## Implementation Order

1. Poster context activation when focused
2. Transform-based zoom/pan (wrapper, scale + translate)
3. Desktop: ctrl+wheel = zoom, click-drag = pan, ctrl+0 = reset
4. Touch: two-finger pinch = zoom, two-finger drag = pan
5. Slice mode: pan always allowed (explore crop)
