# Preference motion audit

Measured against `https://realness.local` with agent-browser, toggling each
preference and reading the DOM immediately after the flip (well inside any
declared transition) and again once settled.

The question each row answers: **when this preference goes off, does the thing
it hides get a chance to animate out, or is it gone before CSS can act?**

Three shapes:

- **removed** - the node leaves the DOM. No exit transition is possible.
- **persists** - the node stays and only its style or attributes change. CSS
  can carry it; the question is only whether it does, and with what.
- **rebuilt** - a whole subtree is torn down. Out of scope here.

## Subject layer

| Preference               | How       | Target                                  | Off behaviour                                 | Verdict                    |
| ------------------------ | --------- | --------------------------------------- | --------------------------------------------- | -------------------------- |
| `mosaic` (group)         | `g`       | poster `use` + `symbol` defs            | 6 uses -> 1 and 6 symbols -> 1, immediately   | **removed**                |
| `boulders` etc (geology) | `Shift+z` | `use[itemprop=boulders]` + its `symbol` | both gone at +50ms, inside the declared 0.44s | **removed**                |
| `info`                   | `i`       | `aside#fps`                             | gone immediately                              | **removed**                |
| `grid`                   | dialog    | `[data-grid-overlay]`                   | gone immediately                              | **removed**                |
| `menu`                   | `Shift+m` | `main#realness > footer`                | gone immediately                              | **removed**                |
| `footer_visible`         | `h`       | same `footer` node                      | node persists, `data-footer-visible` flips    | **persists**               |
| `shadow`                 | `f`       | `use[itemprop=shadow]`                  | node persists                                 | **persists**               |
| `stroke`                 | `s`       | `<animate>` in `as-animation`           | node persists                                 | **persists**               |
| `bold`                   | `z`       | `symbol path[itemprop=bold]`            | node persists                                 | **persists**               |
| `drama`                  | `d`       | `rect#lightbar-back` / `-front`         | nodes persist                                 | **persists**               |
| `animate`                | `a`       | poster `svg`                            | node persists, attribute flips                | **persists**               |
| `storytelling`           | `w`       | whole feed                              | 20 posters -> 19, new node identity           | **rebuilt** - out of scope |

## Control and Reveal layers

Measured in the open preferences dialog (44 `fieldset[data-preference]`):

| Layer                                        | Computed                                                  | Read                                                                                             |
| -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Reveal - nested `fieldset`                   | `grid-template-rows 0.28s cubic-bezier(0.22, 1, 0.36, 1)` | works; this is the pattern to standardise on                                                     |
| Control - `[data-slider]` and its `::before` | `0.4s`                                                    | animates, but it is bare `transition: 0.4s` - every property, default `ease`, no shared constant |

So the control layer is **not** missing motion. It draws on no shared constant
and is over-broad: `transition: 0.4s` on all properties is the classic footgun, and
0.4s is slower than the 0.28s reveal it sits above, so the switch lags the
panel it opens.

## Tier per removal

Removal is sometimes deliberate - it keeps the DOM small. So each removal gets
a tier, not a blanket "keep it mounted":

| Removal                           | Cost of staying mounted                               | Tier                               |
| --------------------------------- | ----------------------------------------------------- | ---------------------------------- |
| `info` - `aside#fps`              | one `aside`, negligible                               | 1 - stay mounted, `display` toggle |
| `grid` - `[data-grid-overlay]`    | four `<line>`s, negligible                            | 1 - stay mounted, `display` toggle |
| `menu` - `main > footer`          | one footer of controls, small                         | 1 - stay mounted, `display` toggle |
| geology layers (`use` + `symbol`) | five masked `use` per poster, measured ~29 vs ~59 fps | 2 - animate out, **then** unmount  |
| `mosaic` group                    | same five, times every poster in the feed             | 2 - animate out, **then** unmount  |

Tier 2 keeps the performance win. The node survives only for the length of the
transition, then leaves, so the standing DOM size is unchanged - only the
moment of removal moves.

## What this changes about the plan

**The removal list is different from a3's reading.** a3 inferred six sites to
convert from reading `v-if`s. Measuring gives five removals, and they are not
the same five:

- Confirmed removals: `mosaic` group, geology layers, `info`, `grid`, `menu`.
- `shadow`, `stroke` and `bold` were on a3's convert list but already keep their
  nodes mounted. They need retargeting at the shared constants, not converting.

**`drama` and `animate` join the persists column**, so the b5 batch is smaller
than planned - those are style and attribute flips on live nodes.

**The mosaic group toggle removes both sides at once**, exactly as the
individual layers do. b3 must convert `as-svg.vue:374` and
`as-poster-symbol.vue:48-64` together or neither works.

**b1 changes shape.** It is not "add motion to the switch", it is "replace an
over-broad `transition: 0.4s` with an explicit property list on the shared
constants, and reconcile its duration with the 0.28s reveal."

## Not measured, and why

| Preference                             | Reason                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `morph`, `color_cycle`                 | pref toggles, but no poster in the feed carries morph data - 0 `animate[itemprop=morph]` nodes to observe |
| `view_3d`                              | toggles the pref, no `canvas` appears on the feed; needs a poster detail page                             |
| `only_mine`                            | no `button[itemprop=feed_filter]` renders on `/thoughts` while signed out                                 |
| `aspect_ratio_mode`, `slice_alignment` | continuous framing values, no show/hide to measure                                                        |

None of these are removals waiting to be found - `morph` and `color_cycle` ride
on `animate`, which persists. They are worth a second look during b4 and b5 on
a page that actually exercises them, not a blocker for GATE A.

## Method notes

Blur the autofocused `textarea#wat` before sending keys. Wrap every
`agent-browser eval` in an IIFE - the scope is reused between calls. Scroll a
poster into view before asserting on `use[itemprop]`: offscreen posters
legitimately carry only their `shadow` use, because `cutouts_mounted` gates on
`intersecting`. `Shift+z` is the working form for uppercase geology shortcuts -
`press Z` registers as `z` and silently toggles `bold` instead.

## Addendum, after b3..b9

The Subject table above is the **pre-b3 measurement** and is kept as the record
of what was wrong. What the verdicts mean now:

| Row                  | Then              | Now                                                                                                                                                                    |
| -------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mosaic` (group)     | removed           | held - the group and its symbols outlive the switch, staggered fine to coarse (b3)                                                                                     |
| geology layers       | removed           | held, and the entrance waits for its symbol so it never fades up over nothing (b9). Symbols are defined for every cutout the poster has, so a press never waits on idb |
| `info`               | removed           | held past the flip, chunk stays lazy (b2)                                                                                                                              |
| `grid`               | removed           | stays mounted, `display` carries it out (b4)                                                                                                                           |
| `menu`               | removed           | footer stays mounted under `data-menu` (b2)                                                                                                                            |
| `shadow`, `bold` etc | persists, instant | SMIL fade over `--duration-subject`; CSS cannot reach a path inside defs (b6, b7)                                                                                      |
| `stroke`             | persists          | still a `v-if` on `<animate>` elements - no rendered box to transition, deliberate                                                                                     |
| `storytelling`       | rebuilt           | unchanged, still out of scope                                                                                                                                          |

Two rows the original audit did not have:

- `slice_alignment` - was three stops on the arrow keys. The arrows now drive
  `camera_y`, a continuous camera (b8), and the stepping commands are deleted.
  The preference is still the framing base; nothing binds to it directly.
- `camera_y` - new. `transform` only, `--duration-camera`, `--ease-camera`.

Live re-verification, all ten layer keys on a real poster, each pressed off and
on: every one round-trips, with the group-off rule holding on both sides -
mosaic off then `Shift+X` returns rocks alone; shadow off then `v` returns light
alone with background still on.
