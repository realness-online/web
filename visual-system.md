# Visual system — Realness

## Module

- A set of 6 irregular polygon tiles derived from the logo's shapes (ash, tide,
  silt, ember, rust, cinder). Each module is a single tile from the set, chosen
  per cell by seed.
  why: the logo is "one square with 6 irregular objects inside" — the system
  decomposes that into a tile set, keeping every output tethered to the brand
  mark

## Grid

- Two modes:
  - **Organized**: 8 x 8 square grid, cell = viewBox / cols, 4% gutter
    why: tight enough for pattern density, loose enough to read individual tiles
  - **Organic**: no fixed grid — tiles placed by seeded poisson-disc or random
    scatter within the viewBox, minimum separation = cell size
    why: the earthy/tactile mood needs room to breathe; organic mode explores
    the loose end of the structured-organic spectrum
- In both modes, tiles may optionally be clipped to a mask shape (circle, band,
  blob) applied to the whole composition
  why: masks add compositional variety without changing the tile rules

## Repetition

- Tile (one module per cell / placement)
  why: variety comes from the tile set + transform + color, not from stacking
  multiple modules in one cell

## Transformation

- Rotate by quantized {0, 90, 180, 270}, seeded
  why: the logo tiles sit at 90deg intervals; this keeps the family coherent
- Positional jitter ±4% of cell in organized mode, seed-driven
  why: controlled irregularity — the tiles should feel set by hand, not by CNC
- In organic mode, rotation is seeded continuous (not quantized) for more
  natural scatter
  why: organic placement + quantized rotation reads as "fallen tiles" —
  intentional contrast to the organized mode

## Color

- Palette: neutral surface (chalk or basalt depending on scheme), fill set from
  the three accent materials: water (blue), clay (terracotta), slate (purple-blue),
  plus pumice (stone gray)
  why: these are the four materials in the logo's smalti fills
- Assignment (organized mode): tile color cycles by (row + col) through the fill
  set, with a seeded 20% chance of swapping to a different accent
  why: position-cycle gives a readable structure; the swap gate prevents
  mechanical repetition
- Assignment (organic mode): pure seeded probability per tile, no positional
  constraint
  why: organic placement needs organic color distribution to match

## Motion

- Every output can be rendered as a still (SVG) or a motion (animated SVG or
  GIF sequence)
  why: "always use elegant motion" — the system should produce outputs that
  can breathe, fade, rotate, or drift
- Motion parameters: per-tile rotation drift (deg/sec), per-tile opacity fade
  cycle, slow positional drift
  why: gentle, continuous motion reads as "alive, not frantic" — the opposite
  of anarchy

## Randomness

- Seed drives: tile selection, rotation, jitter, color assignment, motion params
  why: one seed reproduces any output completely; no anarchy, every variation
  is addressable

## Keepers

_[to be populated from sweep]_

## Notes

- Re-render any keeper by running the generator with these rules + the seed.
- Changing a rule re-sweeps all keepers; verify they still hold.
- Masks are an optional overlay layer, not a core rule — use them in exports
  where the composition benefits from a cutout frame.
