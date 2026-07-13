# Code Review Findings

Status: active
Related: `finishing-touches.md` (critical code-review pass item)

## Goal

Work the codebase-wide bug/readability/test-coverage review to zero before
launch. Findings came from a full pass over `src/` (persistence, components,
composables, utils/workers, views/3d/potrace) cross-referenced against the
`npm run test:risk` coverage/refactor-risk report.

## Fixed

- [x] Mutex double-acquire — `unlock()` cleared `locked` before waking the
      next waiter instead of transferring ownership (`src/utils/algorithms.js`).
- [x] Vectorize queue deadlock — a falsy `image_blob` returned without
      unlocking the mutex, hanging the whole queue (`src/use/vectorize/queue.js`).
- [x] Offline sync race — `sync_offline_actions` drained/deleted the offline
      queue without the same mutex `sync_later` uses to push to it, risking
      data loss (`src/use/sync.js`).
- [x] Tracer worker cross-contamination — overlapping `make:trace` messages
      could let a stale scheduled chunk tick a newer trace's converter; added
      a generation counter (`src/workers/tracer.js`).
- [x] Poster SVGs never keyboard-focusable — `tabable` prop was never
      declared on `as-svg.vue`, so `props.tabable` was always undefined;
      removed the dead hardcoded `focusable` computed and used the working
      `tabindex` computed instead (`src/use/poster.js`, `as-svg.vue`).
- [x] Sign-in code confirm had no error handling — a wrong/expired SMS code
      threw and left the UI spinning forever with no way to retry
      (`src/components/profile/as-form-mobile.vue`).
- [x] Textarea newline insertion bypassed `v-model` — DOM was mutated
      directly without syncing the ref, so a later re-render could silently
      delete the newline the user just typed (`src/components/thoughts/as-textarea.vue`).
- [x] Sync-folder export had no cleanup on failure — a timeout or write
      error left a mounted Vue app, a hidden DOM container, and a stuck
      "working" state (`src/use/sync-folder.js`).
- [x] Three.js resources were never disposed — geometries/materials/textures
      leaked on every mount/unmount in the infinite-scroll feed; added
      `dispose()` to the poster scene controller and wired it into both the
      shared-renderer cleanup and the headless export path
      (`create-poster-scene.js`, `shared-renderer.js`, `with-poster-scene.js`,
      `types.js`).
- [x] Pricing page rewritten from JS-data-driven (`tiers` array + `v-for`) to
      real hand-authored HTML per tier, matching the project's semantic-HTML
      convention (`src/views/Pricing.vue`). Also fixed camelCase
      `onTouchStart`/`onTouchEnd` to snake_case; codebase-wide search found
      no other stray camelCase handlers (remaining camelCase is justified:
      `vVectorizer` directive naming in `App.vue`, generated wasm bindings,
      and the deliberate C-potrace port in `src/potrace/index.js`).
- [x] Stripe CTA keys reviewed — not a real leak (publishable key, single
      call site with explicit values every time); left as-is.
- [x] download-vector.vue missing try/finally — `png_layers`/
      `download_png_handler` called `set_working(true)` with no try/finally;
      a thrown error left the UI stuck in "working" state.
      `download_glb_handler` in the same file already did this correctly —
      copied the pattern. Added regression tests
      (`tests/components/download-vector.spec.js`, previously 0% covered).
- [x] Stale async response races — `as-figure.vue`'s dom-reference
      `watch_effect` could call `on_show` for a superseded `itemid` if it
      changed mid-load; now checks `props.itemid` still matches before
      calling `on_show`. `as-symbol.vue`'s `load_symbol` had no guard at all;
      added a `load_token` counter matching the `cutout_load_token` pattern
      already used elsewhere in `as-figure.vue`.
- [x] Cloud.js partial archive failure had no rollback — confirmed each
      individual `move()` is already self-healing (uploads to new location,
      only deletes old after success; rolls itself back on failure), so this
      was never a data-loss risk — but a poster's 7 files (main + 6 layers)
      moving concurrently could end up split across live/archive locations
      forever if some succeeded and some failed. Added a `restore` direction
      to `move()` (`src/utils/serverless.js`) that reverses a single
      component's move, and wired `archive_poster` (`src/persistence/Cloud.js`)
      to roll back the succeeded components when a sibling fails, so a
      partial failure now returns the poster to a fully consistent,
      un-archived state instead of a permanent split. Removed the now-dead
      `had_partial_failure` recursion guard. Added tests for the `restore`
      direction and the rollback behavior.
- [x] Unguarded array access — `src/use/statements.js:60-68`
      `statement_shown` read `author_statements[length - 1]` without checking
      for an empty array, throwing for an author with zero statements in the
      current feed slice. Added an early return; added a regression test.
- [x] Loop abort instead of skip — `src/use/directory-processor.js` used
      `return` instead of `continue` inside the `for await` batch-import
      loop for two falsy-poster guards, so a bad file could abort the whole
      import silently. Changed both to `continue` (with a console.error so
      the skip isn't silent) — a defensive fix: the preceding wait-loops
      already prevent `poster`/`final_poster` from being falsy in practice,
      so I couldn't construct a natural test that reaches either guard;
      existing test suite (25 tests) still passes unchanged.
- [x] localStorage mutation mid-iteration — `as-sign-on.vue`'s `clean()`
      removed keys via `for...in` while iterating `localStorage` directly,
      which can skip keys depending on engine/host-object iteration
      semantics. Now snapshots the keys into an array first, then removes
      them. Added a regression test with 20 keys.
- [x] Divide-by-zero → Infinity/NaN — `Histogram.js`'s `get_stats` divided
      by `(max - min)` for `pixelsPerLevel.mean`, which is 0 for a
      single-level range (distinct from the already-documented "no pixels"
      NaN case); now falls back to `1` (the semantically correct divisor —
      one level). `potrace/index.js`'s `#calc_color_intensity` divided by
      `(colorStops_length - 1)`, 0 for a single color stop; same `|| 1`
      guard, since `index` is always 0 there too so the result is unchanged
      (0) for every other case. Added unit tests for `Histogram.get_stats`
      and an end-to-end `as_paths` test asserting no `NaN` fillOpacity with
      `FILL_SPREAD` and a single color stop.
- [x] Zero-height poster SVG → Infinity scale — `create-poster-scene.js`'s
      `scale = FIT_HEIGHT / height` had no guard against `height === 0` (or
      `NaN` from a malformed viewBox); now falls back to `1`. Added a test
      that forces a zero-height layer parse and asserts the resulting mesh
      geometry's vertex positions are all finite.
- [x] Duplicate HTML id — `as-form-name.vue` had `id="name"` on both a
      `<fieldset>` and its `<input>`. Confirmed the CSS only ever targets
      `input#name` (never bare `#name`), so the fieldset's id was unused;
      removed it. No behavior change, existing render tests cover it.
- [x] Worker message handlers missing try/catch — `compressor.js` and
      `vector.js` now catch and reply with `{ error }` the same way
      `tracer.js` already does, so a thrown error settles the caller instead
      of hanging forever. Updated `upload-processor.js` (compressor's only
      Promise-based consumer) to reject on an error-shaped reply instead of
      resolving `undefined.blob`/`undefined.html`. Added regression tests
      for both workers' listeners and for `upload-processor.js`'s new
      rejection path.
- [x] **Follow-up**: `vectorize.js`'s `vectorized`/`gradientized`/`optimized`
      handlers now check for an error-shaped reply from the vector worker
      too. `vectorized` and `optimized` share a new `fail_current_item(id,
error)` helper — logs the error, marks the queue item `status: 'error'`
      via `Queue.update`, cleans up the in-flight blob reference, resets
      pipeline state, and calls `run_queue()` so one failed image no longer
      silently stalls the entire rest of the upload queue (previously the
      chain of `vectorized → optimized → run_queue()` message handlers would
      just stop dead, and nothing else would ever get processed).
      `gradientized` (a secondary/non-blocking output) just logs and returns
      rather than aborting the item. Added tests dispatching a synthetic
      error reply to each of the three handlers via the mounted worker mocks.
- [x] as-animation.vue SMIL bug — the `vertical-bold` y1 gradient animation
      had `begin="indefinite"` while every other animation in the file
      (39 of them) uses `begin="0s"` — a copy-paste bug that meant this one
      animation never started (nothing in the codebase calls
      `.beginElement()` to trigger it manually). Fixed to `"0s"`. Added a
      regression test asserting every leaf `<animate>` element has
      `begin="0s"` (no test file existed for this component before).

## Investigated, not reproducible

- **Shared cutouts object mutation** — original review claimed
  `as-figure.vue`/`as-avatar.vue` could race on a shared `vector.cutouts`
  object across a figure + avatar instance of the same poster. Traced the
  actual data flow: `load()` and `load_cutout_flags()` both build fresh
  objects on every call (no cache), and `poster-instances.js`'s canonical
  election ensures only one instance (avatar or figure) is ever actively
  loading/mutating cutouts for a given poster id at a time — the rest
  render `<use href="#…">` and never touch `.cutouts`. No fix made.

## Remaining (medium severity)

None — all fixed. See `Fixed` above for the full list.

## Resolved after discussion

- [x] **svg-to-video.js frame timing** — discussed with the user. The 8x
      speedup wasn't a bug per se: `FRAMES_PER_SECOND` (3) controls how many
      frames get expensively rendered from the SVG (generation cost), while
      `fps` only relabels playback speed of frames already rendered — free
      to change. Confirmed intent: "one loop" through the poster animation,
      generation time being the binding constraint. The 8x compression felt
      "distractingly fast" in practice; first tried lowering `fps` to 6, but
      the user wanted to keep a standard 24fps file. Final approach: kept
      `fps = 24` and added `FRAME_HOLD = 4` — each rendered frame (sampled
      at `FRAMES_PER_SECOND`) is submitted to the encoder 4 times in a row
      (`encoded_frame_count = total_frames * FRAME_HOLD`), so the output is
      a genuine 24fps file that paces at the same calm ~2x speed as the
      fps=6 attempt, at no extra rendering cost — only the encoder does
      slightly more (cheap) work. Added `tests/utils/svg-to-video.spec.js`
      (previously 0% covered, no test file existed) asserting the exact
      encoded-frame count and timestamp spacing, and updated
      `download-vector.spec.js`'s test to check wiring instead of the
      now-internal pacing detail.
- [x] **svg-to-video.js encoder/stream cleanup on error** — not revisited;
      lower priority than the timing question and no longer blocking since
      the timing discussion resolved the main open question on this file.

## Quality improvements (beyond the original bug list)

- [x] **Video bitrate too low** — `VIDEO_BITRATE` was 2.5 Mbps, well under
      standard 1080p recommendations, producing visible blocking/banding on
      fine vector line art and gradients. Raised to 8 Mbps, then to 14 Mbps
      alongside a resolution bump (`target_smallest_side` 1080 → 1440 in
      `download-vector.vue`) — bitrate is a fixed bits/sec target unrelated
      to resolution, so it has to scale with pixel count (~1.8x here) to
      keep the same bits-per-pixel density, otherwise a bigger canvas just
      spreads the same data over more pixels with no real quality gain.
      Final: 1440p short side @ 14 Mbps (~315MB for the ~180s loop) —
      confirmed by the user to look noticeably better.
- [x] **Stepped/held motion look** — the `FRAME_HOLD` approach repeated one
      rasterized pose identically across 4 encoded ticks, reading as a
      discrete jump every ~1/6s rather than smooth drift. Split
      `capture_svg_frame` into `rasterize_svg_frame` (produces an Image,
      doesn't draw) and `draw_blended_frame` (cross-fades two images by
      alpha), and reworked the render loop to rasterize one frame ahead and
      cross-fade toward it across the held ticks — same number of
      rasterizations as before (still bound by `FRAMES_PER_SECOND`, no
      change in generation cost), just smoother-looking motion between
      samples. Added tests asserting rasterization count is unchanged and
      that partial-alpha blending actually occurs.

## Verification

Each fix gets its own targeted test run (`npx vp test run <affected spec>`)
plus a full-suite `npx vp test run` before moving to the next item. Full
suite is green (133 files / 1249 tests) as of the latest fix.
