# User Experience Refactor

## Goals

- One thought feed (statements = internal term for text portion of a thought; not exposed in UX)
- Remove Navigation — feed is the sole entry

## Target State

| Path | View         | Purpose                                                                                 |
| ---- | ------------ | --------------------------------------------------------------------------------------- |
| `/`  | Unified feed | Thoughts (text + posters) in one chronological feed; create via camera or file selector |

Posters.vue re-arranges layout via CSS (class toggles, no DOM reorder):

- **standard-grid** — responsive auto-fill, minmax(325px/425px), grid-gap
- **slice** — grid-gap: 0 (edge-to-edge); SVG preserveAspectRatio slice with slice_alignment (ymid/ymin/ymax)
- **storytelling** — article → flex, overflow-x, horizontal scroll; each poster min-width 100vw; header hidden; focus scrolls to center
- **menu** — fill-screen when menu preference on; menu content differs by ownership (below)
- **selecting-event** — dim non-selected when picking
- **processing** — currently_processing spans full width (grid-column 1/-1)

## Merge Strategy

- Base: Thoughts.vue (posters + thoughts in chronological feed)
- Add: Edit own thoughts — `editable` on thought-as-article for my thoughts
- Add: thought-as-textarea from Navigation — create-thought UX lives in feed
- Reuse: as-days, thought-as-article, poster-as-figure
- Flow: my thoughts (editable) + relations’ posters/thoughts in chronological feed

## Functionality to Migrate: Create Thought

- Save new thought on blur/submit
- Expand/collapse for focused posting mode
- Keymap: Save, New_Line, Cancel

## Functionality to Migrate: Posters

- Pick multiple images from filesystem → batch poster creation
- Batch from camera
- Batch from directory — globally from App (new, not fully tested)
- Processing queue (show work in progress) — as-svg-processing, init_processing_queue, queue_items watch. All poster creation lives in feed.
- **Poster menu by ownership** — author menu when I own (remove, avatar, event, download); standard menu for others’ (link, messenger, download)
- Layout modes: storytelling (full-screen horizontal), slice, grid; centered scroll on focus

Ownership: as_author(itemid) === localStorage.me. Derive menu from that—no props.

## Functionality to Migrate: Navigation

Requires real work — these live in Navigation today, need a home in feed header/UI:

- **Account** — relabel sign-in as "come join"
- **About** — version display, link to /about (version parts in header)
- **Links** — phonebook, events
- **Camera** — open camera for poster capture

Account dialog (as-dialog-account), about link styling, focus/visibility behavior all need migration.

## Router Changes

```
/  → Unified feed (new)
```

Remove or redirect: `/statements`, `/thoughts`, `/posters`, Navigation

vectorize listener: change router.push('/posters') → router.push('/')

Keymap: remove nav commands for dead views (Go_Statements, Go_Posters, Go_Thoughts). Go_Home stays.

First visit: land on feed (/) instead of redirecting to /about. Remove sessionStorage.about check or repurpose.

Posting mode: isolate user from rest of UX while writing—hide/suppress header, links, etc. Full focus on thought textarea.

## Preferences Dialog (as-dialog-preferences)

All toggles and actions that must be supported in the refactor. Dialog is fixed bottom-left; hides in fullscreen and when `article.thought:focus-within`. Keymap panel hidden on mobile (`@media (min-width: pad-begins)`).

### Poster visual layers

| Preference                               | Description                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| mosaic                                   | Color mosaic layer                                                          |
| shadow                                   | Shadow gradients (enables bold, medium, regular, light, background when on) |
| stroke                                   | Outline on shadow layer                                                     |
| drama                                    | Dynamic lighting                                                            |
| bold, medium, regular, light, background | Shadow sublayers                                                            |
| boulders, rocks, gravel, sand, sediment  | Geology sublayers                                                           |

### Poster display

| Preference        | Description                                          |
| ----------------- | ---------------------------------------------------- |
| animate           | Poster animation                                     |
| animation_speed   | Cycle: normal / slow / fast                          |
| slice_alignment   | ymin / ymid / ymax                                   |
| aspect_ratio_mode | Cycle: auto / 1/1 / 1.618/1 / 16/9 / 2.35/1 / 2.76/1 |
| grid_overlay      | Debug grid                                           |

### Feed / layout

| Preference   | Description                   |
| ------------ | ----------------------------- |
| storytelling | Side-scroll view (horizontal) |
| menu         | Show poster menu on click     |

### Debug

| Preference | Description                    |
| ---------- | ------------------------------ |
| info       | FPS and animation info overlay |

### Export

| Preference  | Description                                                                         |
| ----------- | ----------------------------------------------------------------------------------- |
| adobe       | HEX vs other color in downloads (hidden in dialog)                                  |
| sync_folder | Export to folder (toggle + "Choose folder"); only when `showDirectoryPicker` exists |

### UI actions (not toggles)

| Command                 | Description             |
| ----------------------- | ----------------------- |
| ui::Open_Settings       | Open preferences dialog |
| ui::Open_Account        | Account dialog          |
| ui::Show_Documentation  | Docs                    |
| ui::Toggle_Presentation | Presentation mode       |

### Refactor considerations

- On mobile: toggles only; no keyboard shortcuts; dialog must remain accessible for all of the above
- Feed filters (content × scope) need a home; could live in this dialog or separate control
- sync_folder uses `showDirectoryPicker` — limited support on mobile
