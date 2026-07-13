# Mask Subjects — plan

Finish the mask-pen feature: turn an ephemeral path selection into named **subjects** —
groups of geology cells that become their own thing within a poster, separable from the rest.
A poster has a few subjects (e.g. _Face_, _Flower_, _Foreground_).

- App: `work/realness`
- Supersedes the "finish mask functionality" item in `docs/plans/finishing-touches-plan.md`.

## Concept

- A geology **cell** is one `<path>` in a geology layer symbol, addressed positionally as
  `"<layer>:<index>"` (e.g. `rocks:3`). Stable because a poster's layers don't change once
  persisted.
- A **subject** is a named set of cells. Each cell is owned by at most one subject (exclusive).
- Subjects are referenced, never copied — we store the lightweight `layer:index` pointers,
  not path geometry (keeps the index file tiny; geometry already lives in the layer files).

## Data shape (persisted in the poster index file)

SVG-native microdata in `<metadata>` so it survives the HTML-context parse (`hydrate` →
`createContextualFragment`). No HTML breakout-list tags; `item.js` reads `<desc>` via its
`textContent` fallback and forms an array from repeated `itemprop="subject"`.

```svg
<svg itemscope itemtype="/posters" itemid="…/posters/1576588885385" viewBox="0 0 333 444">
  …poster content / layer references…
  <metadata>
    <g itemprop="subject" itemscope itemtype="/subject"
       itemid="…/posters/1576588885385/subjects/1700000900001">
      <desc itemprop="name">Flower</desc>
      <desc itemprop="members">rocks:3 rocks:4 sand:7</desc>
    </g>
  </metadata>
</svg>
```

- `itemid` ends in a creation timestamp, not the name — renaming never changes identity.
- `members` packed into one whitespace-separated `<desc>` (smallest on disk).
- Parses to `poster.subject = [{ name, members }]`; normalized in memory to
  `subjects = [{ id, name, keys: Set<string> }]`.

## Pieces

1. **Model** (`src/use/mask-pen.js`) — generalize the single `selected` Set into a list of
   named subjects + an active subject. Painting toggles cells into the active subject;
   exclusive ownership (selecting a cell for one subject removes it from another). Keep
   `selected` as a computed view of the active subject so current consumers keep working.
   `add/select/rename/remove` subject; `clear` empties the active subject.
2. **Persistence** — serialize subjects into the index `<metadata>` on save; parse back via
   `get_item` on load (whitespace-split `members`). Round-trips `layer:index` references only.
3. **Render / separate** (`as-svg` / `as-mask-pen`) — base geology renders _minus_ cells
   claimed by subjects; each subject renders as its own `<g itemtype="/subject">` resolved
   from the cells, so it is a distinct, independently-transformable group. v1 stops at
   making them real/named/separable groups; actually moving a subject is v2.
4. **UI** (`as-figure` mask toolbar) — name field + a small list of the poster's subjects
   (re-select / rename / delete), active subject indicated.

## Out of scope (v2)

- Moving / offsetting / animating a subject (2D drag, or per-subject depth in 3D).
- Potrace-smoothed silhouette outline (only if we later want a soft boundary look).

## Verification

- Unit: election/model in `tests/use/mask-pen.spec.js` (subjects, exclusive ownership).
- Manual: author 2–3 subjects on a poster, reload (persists), confirm each renders as its
  own group and the base layers don't double-draw the claimed cells.
